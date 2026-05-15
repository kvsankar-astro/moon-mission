#!/usr/bin/env python3
"""
Upload staged runtime assets to the sankara.net Cloudflare R2 bucket.

The script intentionally has no dependency on the AWS CLI. It signs S3-compatible
requests directly with AWS Signature V4 and reads the same .env names documented
in .env.example.
"""

from __future__ import annotations

import argparse
import datetime as dt
import fnmatch
import hashlib
import hmac
import mimetypes
import os
import posixpath
import sys
import time
from pathlib import Path
from typing import Dict, Iterable, List, Tuple
from urllib.parse import quote, urlparse

import requests


DEFAULT_PREFIX = "moon-mission/"
DEFAULT_ROOTS = ("assets", "images", "third-party")
DEFAULT_JSON_CACHE_CONTROL = "public, max-age=300"
DEFAULT_ASSET_CACHE_CONTROL = "public, max-age=86400"
DEFAULT_IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"


def as_trimmed_string(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        key = name.strip()
        if not key or key in os.environ:
            continue
        os.environ[key] = value.strip().strip('"').strip("'")


def require_env(name: str) -> str:
    value = as_trimmed_string(os.environ.get(name))
    if not value or value.startswith("<"):
        raise RuntimeError(f"Missing required environment value: {name}")
    return value


def normalize_prefix(prefix: str) -> str:
    normalized = as_trimmed_string(prefix).replace("\\", "/").strip("/")
    return f"{normalized}/" if normalized else ""


def normalize_key(*parts: str) -> str:
    joined = posixpath.join(*[part.strip("/") for part in parts if part])
    return joined.replace("\\", "/")


def iter_upload_files(
    source_root: Path,
    roots: Iterable[str],
    exclude_patterns: Iterable[str] = (),
) -> Iterable[Tuple[Path, str]]:
    normalized_excludes = [
        pattern.replace("\\", "/")
        for pattern in exclude_patterns
        if as_trimmed_string(pattern)
    ]
    for root_name in roots:
        rel_root = Path(root_name)
        absolute_root = source_root / rel_root
        if not absolute_root.exists():
            print(f"Skipping missing asset root: {absolute_root}")
            continue
        if not absolute_root.is_dir():
            raise RuntimeError(f"Asset root is not a directory: {absolute_root}")
        for path in sorted(absolute_root.rglob("*")):
            if path.is_file():
                rel_path = path.relative_to(source_root).as_posix()
                if any(fnmatch.fnmatch(rel_path, pattern) for pattern in normalized_excludes):
                    continue
                yield path, rel_path


def content_type_for(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".m3u8":
        return "application/vnd.apple.mpegurl"
    if suffix == ".m4s":
        return "video/iso.segment"
    if suffix == ".json5":
        return "application/json"
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def cache_control_for(rel_path: str) -> str:
    lower = rel_path.lower()
    if lower.endswith((".json", ".json5", ".m3u8")):
        return DEFAULT_JSON_CACHE_CONTROL
    if "/media/streams/" in lower and lower.endswith((".mp4", ".m4s", ".webvtt", ".jpg", ".webp", ".png")):
        return DEFAULT_IMMUTABLE_CACHE_CONTROL
    return DEFAULT_ASSET_CACHE_CONTROL


def sha256_hex(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def md5_hex(payload: bytes) -> str:
    return hashlib.md5(payload, usedforsecurity=False).hexdigest()


def sign(key: bytes, message: str) -> bytes:
    return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()


class R2Client:
    def __init__(
        self,
        *,
        endpoint: str,
        bucket: str,
        access_key_id: str,
        secret_access_key: str,
        region: str = "auto",
    ) -> None:
        self.endpoint = endpoint.rstrip("/")
        self.bucket = bucket
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self.region = region or "auto"
        parsed = urlparse(self.endpoint)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise RuntimeError(f"Invalid R2 endpoint: {endpoint}")
        self.host = parsed.netloc

    def object_url(self, key: str) -> str:
        encoded_key = quote(key, safe="/-_.~")
        return f"{self.endpoint}/{self.bucket}/{encoded_key}"

    def _authorization_headers(
        self,
        *,
        method: str,
        key: str,
        payload_hash: str,
        extra_headers: Dict[str, str] | None = None,
    ) -> Dict[str, str]:
        now = dt.datetime.now(dt.timezone.utc)
        amz_date = now.strftime("%Y%m%dT%H%M%SZ")
        date_scope = now.strftime("%Y%m%d")
        headers = {
            "host": self.host,
            "x-amz-content-sha256": payload_hash,
            "x-amz-date": amz_date,
        }
        for name, value in (extra_headers or {}).items():
            headers[name.lower()] = value

        signed_header_names = sorted(headers)
        canonical_headers = "".join(
            f"{name}:{' '.join(str(headers[name]).strip().split())}\n"
            for name in signed_header_names
        )
        signed_headers = ";".join(signed_header_names)
        canonical_uri = f"/{self.bucket}/{quote(key, safe='/-_.~')}"
        canonical_request = "\n".join([
            method.upper(),
            canonical_uri,
            "",
            canonical_headers,
            signed_headers,
            payload_hash,
        ])
        credential_scope = f"{date_scope}/{self.region}/s3/aws4_request"
        string_to_sign = "\n".join([
            "AWS4-HMAC-SHA256",
            amz_date,
            credential_scope,
            sha256_hex(canonical_request.encode("utf-8")),
        ])

        signing_key = sign(
            sign(
                sign(
                    sign(f"AWS4{self.secret_access_key}".encode("utf-8"), date_scope),
                    self.region,
                ),
                "s3",
            ),
            "aws4_request",
        )
        signature = hmac.new(signing_key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
        headers["authorization"] = (
            "AWS4-HMAC-SHA256 "
            f"Credential={self.access_key_id}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, "
            f"Signature={signature}"
        )
        return headers

    def head(self, key: str) -> requests.Response:
        payload_hash = sha256_hex(b"")
        headers = self._authorization_headers(
            method="HEAD",
            key=key,
            payload_hash=payload_hash,
        )
        return request_with_retries("HEAD", self.object_url(key), headers=headers, timeout=30)

    def put(
        self,
        key: str,
        payload: bytes,
        *,
        content_type: str,
        cache_control: str,
    ) -> requests.Response:
        payload_hash = sha256_hex(payload)
        extra_headers = {
            "cache-control": cache_control,
            "content-length": str(len(payload)),
            "content-type": content_type,
        }
        headers = self._authorization_headers(
            method="PUT",
            key=key,
            payload_hash=payload_hash,
            extra_headers=extra_headers,
        )
        return request_with_retries(
            "PUT",
            self.object_url(key),
            data=payload,
            headers=headers,
            timeout=120,
        )


def request_with_retries(method: str, url: str, *, attempts: int = 4, **kwargs) -> requests.Response:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            response = requests.request(method, url, **kwargs)
            if response.status_code in (429, 500, 502, 503, 504) and attempt < attempts:
                time.sleep(min(2 ** attempt, 10))
                continue
            return response
        except requests.RequestException as error:
            last_error = error
            if attempt >= attempts:
                raise
            time.sleep(min(2 ** attempt, 10))
    if last_error:
        raise last_error
    raise RuntimeError(f"{method} request failed without a response: {url}")


def should_skip_existing(response: requests.Response, payload: bytes) -> bool:
    if response.status_code != 200:
        return False
    length = response.headers.get("content-length")
    if length is not None:
        try:
            if int(length) != len(payload):
                return False
        except ValueError:
            return False
    etag = as_trimmed_string(response.headers.get("etag")).strip('"').lower()
    return bool(etag) and etag == md5_hex(payload)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload staged Moon Mission assets to Cloudflare R2")
    parser.add_argument("--source-root", required=True, help="Directory containing staged asset roots")
    parser.add_argument("--env-file", default=".env", help="Optional .env file to load")
    parser.add_argument("--prefix", default=DEFAULT_PREFIX, help="R2 object key prefix")
    parser.add_argument(
        "--roots",
        nargs="+",
        default=list(DEFAULT_ROOTS),
        help="Top-level source directories to upload",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print planned uploads without writing")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Upload even when remote ETag and size match",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="Glob pattern, relative to source root, to skip. May be passed more than once.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_root = Path(args.source_root).resolve()
    if not source_root.exists():
        print(f"ERROR: source root does not exist: {source_root}", file=sys.stderr)
        return 1

    load_dotenv(Path(args.env_file))
    prefix = normalize_prefix(args.prefix)
    client = R2Client(
        endpoint=require_env("R2_S3_ENDPOINT_SANKARA_NET"),
        bucket=require_env("R2_BUCKET_SANKARA_NET"),
        access_key_id=require_env("AWS_ACCESS_KEY_ID_SANKARA_NET"),
        secret_access_key=require_env("AWS_SECRET_ACCESS_KEY_SANKARA_NET"),
        region=as_trimmed_string(os.environ.get("AWS_REGION_SANKARA_NET")) or "auto",
    )

    planned = 0
    uploaded = 0
    skipped = 0
    total_bytes = 0
    for path, rel_path in iter_upload_files(source_root, args.roots, args.exclude):
        key = normalize_key(prefix, rel_path)
        payload = path.read_bytes()
        planned += 1
        total_bytes += len(payload)
        if args.dry_run:
            print(f"DRY RUN {rel_path} -> {key} ({len(payload)} bytes)")
            continue

        if not args.force:
            head_response = client.head(key)
            if should_skip_existing(head_response, payload):
                skipped += 1
                if (uploaded + skipped) % 500 == 0:
                    print(f"Processed {uploaded + skipped} file(s); uploaded {uploaded}; skipped {skipped}")
                continue

        response = client.put(
            key,
            payload,
            content_type=content_type_for(path),
            cache_control=cache_control_for(rel_path),
        )
        if response.status_code not in (200, 201, 204):
            print(
                f"ERROR: upload failed for {rel_path} -> {key}: "
                f"{response.status_code} {response.text[:500]}",
                file=sys.stderr,
            )
            return 1
        uploaded += 1
        if uploaded % 100 == 0:
            print(f"Uploaded {uploaded} file(s); skipped {skipped}; latest {rel_path}")

    action = "Planned" if args.dry_run else "Uploaded"
    print(
        f"{action} {planned} file(s), {total_bytes} bytes "
        f"to r2://{client.bucket}/{prefix}"
        + (f" ({uploaded} written, {skipped} unchanged)" if not args.dry_run else ""),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

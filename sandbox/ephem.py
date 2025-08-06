
from skyfield.api import load, wgs84, N, E
from skyfield.framelib import ecliptic_J2000_frame, ecliptic_frame

planets = load('de421.bsp')
earth, moon = planets['earth'], planets['moon']
bangalore = earth + wgs84.latlon(12.9716 * N, 77.5946 * E)
ts = load.timescale()
t = ts.utc(2010, 1, 1, 0, 0, 0)

geometric = earth.at(t).observe(moon)
lat, lon, distance = geometric.frame_latlon(ecliptic_frame)
print(f'lon={lon._degrees}, lat={lat._degrees}')

apparent = bangalore.at(t).observe(moon).apparent()
ra, dec, distance = apparent.radec(epoch='date')
print(f'ra={ra._degrees}, dec={dec._degrees}')

# end of file
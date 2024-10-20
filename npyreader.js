function preprocessNpyHeader(headerText) {
    // Replace single quotes with double quotes
    let jsonText = headerText.replace(/'/g, '"');
  
    // Replace Python-specific values with their JSON equivalents
    jsonText = jsonText.replace(/\bNone\b/g, 'null');  // Replace None with null
    jsonText = jsonText.replace(/\bTrue\b/g, 'true');  // Replace True with true
    jsonText = jsonText.replace(/\bFalse\b/g, 'false');  // Replace False with false
  
    // Replace Python-style tuples with JSON-friendly arrays
    jsonText = jsonText.replace(/\(([^()]+)\)/g, function(match, contents) {
      const items = contents.split(',').map(item => item.trim());
      return `[${items.join(', ')}]`;
    });
  
    // Remove trailing commas in dictionaries
    jsonText = jsonText.replace(/,(\s*[\}\]])/g, '$1');
  
    return jsonText;
  }
  
  export function parseNpy(buffer) {
    const view = new DataView(buffer);
  
    // Magic string "NUMPY"
    const magic = String.fromCharCode(...new Uint8Array(buffer.slice(0, 6)));
    if (magic !== '\x93NUMPY') {
      throw new Error("This is not a valid NPY file.");
    }
  
    // Major and minor version
    const majorVersion = view.getUint8(6);
    const minorVersion = view.getUint8(7);
    if (majorVersion !== 1 && majorVersion !== 2) {
      throw new Error("Unsupported NPY file version.");
    }
  
    // Header length
    const headerLen = view.getUint16(8, true);
    const headerText = String.fromCharCode(...new Uint8Array(buffer.slice(10, 10 + headerLen)));
  
    // Preprocess and parse the header
    const processedHeaderText = preprocessNpyHeader(headerText);
    const header = JSON.parse(processedHeaderText);
  
    const dtype = header.descr;
    const shape = header.shape;
    const fortranOrder = header.fortran_order;
  
    // console.log('Header:', header);
    // console.log('Data type:', dtype);
    // console.log('Shape:', shape);
    // console.log('Fortran order:', fortranOrder);
  
    // Calculate the total number of elements in the array
    const totalElements = shape.reduce((a, b) => a * b, 1);
    // console.log('Total elements:', totalElements);

    // Data offset (10 bytes for the magic number, version, and header length + header length itself)
    const dataOffset = 10 + headerLen;
    // console.log('Data offset:', dataOffset);
    // console.log('Buffer byte length:', buffer.byteLength);
  
    // Ensure the buffer is large enough for the data
    if (dataOffset >= buffer.byteLength) {
      throw new Error(`Data offset ${dataOffset} exceeds buffer size ${buffer.byteLength}`);
    }
  
    const dataBuffer = buffer.slice(dataOffset);
  
    // Handle both scalar arrays and structured arrays
    let data;
  
    // console.log('dtype: ' + dtype);

    if (typeof dtype === 'string') {
      // Scalar array case
      const typeSize = parseInt(dtype.match(/\d+/)[0]) / 8;
      // console.log('Type size:', typeSize);
  
      if (dtype === '<f8') { // float64
        data = new Float64Array(dataBuffer);
      } else if (dtype === '<i4') { // int32
        data = new Int32Array(dataBuffer);
      } else if (dtype === '<i8') { // int64
        data = new BigInt64Array(dataBuffer);
      } else {
        throw new Error(`Unsupported dtype: ${dtype}`);
      }
  
      // Log the data size and ensure it's within bounds
      // console.log('Expected data size:', totalElements * typeSize);
      // console.log('Actual data byte length:', data.byteLength);
  
      if (data.byteLength < totalElements * typeSize) {
        throw new Error(`Mismatch between expected and actual data size: ${data.byteLength} vs ${totalElements * typeSize}`);
      }
  
      data = Array.from(data);  // Convert typed array to regular array
    } else if (Array.isArray(dtype)) {
      // Structured array case
      data = [];
      const recordSize = dtype.reduce((acc, [fieldName, fieldType]) => {
        const fieldSize = parseInt(fieldType.match(/\d+/)[0]);
        // console.log("Field name: " + fieldName);
        // console.log("Field type: " + fieldType);
        // console.log("Field size: " + fieldSize);
        return acc + fieldSize;
      }, 0);
  
      for (let i = 0; i < totalElements; i++) {
        // console.log("Processing record " + i);
        const record = {};
        let recordOffset = i * recordSize;
        // console.log("Record offset: " + recordOffset);

        dtype.forEach(([fieldName, fieldType]) => {
          const fieldSize = parseInt(fieldType.match(/\d+/)[0]);
          if (fieldType === '<f8') {
            record[fieldName] = new DataView(dataBuffer, recordOffset, fieldSize).getFloat64(0, true);
          } else if (fieldType === '<i4') {
            record[fieldName] = new DataView(dataBuffer, recordOffset, fieldSize).getInt32(0, true);
          } else if (fieldType === '<i8') {
            record[fieldName] = new DataView(dataBuffer, recordOffset, fieldSize).getBigInt64(0, true);
          } else {
            throw new Error(`Unsupported field dtype: ${fieldType}`);
          }
  
          recordOffset += fieldSize;
        });
  
        data.push(record);
      }
    } else {
      throw new Error(`Unknown dtype format: ${dtype}`);
    }
  
    return {
      dtype,
      shape,
      data,
      fortranOrder,
    };
  }  
  
  // end of file

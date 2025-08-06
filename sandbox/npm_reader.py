import numpy as np
import sys

def read_npy_file(file_path):
    # Load the .npy file
    data = np.load(file_path, allow_pickle=True)
    
    # Print the schema (dtype and shape)
    print("Schema:")
    print(f"Data type: {data.dtype}")
    print(f"Shape: {data.shape}")
    
    # Print the contents
    print("\nContents:")
    print(data)

if __name__ == "__main__":
    # Check if a file path is provided as a command line argument
    if len(sys.argv) < 2:
        print("Usage: python script_name.py <path_to_npy_file>")
        sys.exit(1)
    
    # Get the file path from the first command line argument
    npy_file_path = sys.argv[1]
    
    # Read and print schema and contents
    read_npy_file(npy_file_path)


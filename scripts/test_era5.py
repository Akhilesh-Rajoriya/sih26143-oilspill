import cdsapi

def test_connection():
    client = cdsapi.Client()

    client.retrieve(
        "reanalysis-era5-single-levels",
        {
            "product_type": "reanalysis",
            "variable": ["10m_u_component_of_wind", "10m_v_component_of_wind"],
            "year": "2024",
            "month": "01",
            "day": "01",
            "time": "12:00",
            "area": [20, 68, 6, 90],  # North, West, South, East — rough India coastal box
            "format": "netcdf",
        },
        "D:/SIH_OilSpill/data/era5_test.nc"
    )

    print("SUCCESS: file downloaded to D:/SIH_OilSpill/data/era5_test.nc")

if __name__ == "__main__":
    test_connection()
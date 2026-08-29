import xarray as xr

ds = xr.open_dataset("D:/SIH_OilSpill/data/era5_test.nc")
print(ds)
print("\nVariables:", list(ds.data_vars))
print("Wind U sample value:", ds['u10'].values.flat[0])
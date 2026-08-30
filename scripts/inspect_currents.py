import xarray as xr

ds = xr.open_dataset("D:/SIH_OilSpill/data/slick1_currents_hourly.nc")
print(ds)
print("\nVariables:", list(ds.data_vars))
print("Number of time steps:", ds.sizes['time'])
print("Current U (total) sample value:", ds['utotal'].values.flat[0])
print("Current V (total) sample value:", ds['vtotal'].values.flat[0])
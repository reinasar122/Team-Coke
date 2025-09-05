import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { successStyle } from "../utils/toastStyles";
import psgcData from "../data/psgc_output.json"; 

const WarehouseForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    country: "Philippines",
    region: "",
    province: "",
    city: "",
    barangay: "",
    street_address: "",   // ✅ match model
    zip_code: "",
    phone_number: "",
    email: "",
  });

  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  useEffect(() => {
    const selectedRegion = psgcData.find(
      (region) => region.region_name === formData.region
    );
    setProvinces(selectedRegion ? selectedRegion.provinces : []);
    setFormData((prev) => ({
      ...prev,
      province: "",
      city: "",
      barangay: "",
    }));
    setCities([]);
    setBarangays([]);
  }, [formData.region]);

  // Province -> Cities
  useEffect(() => {
    const selectedProvince = provinces.find(
      (p) => p.province_name === formData.province
    );
    setCities(selectedProvince ? selectedProvince.cities || [] : []);
    setFormData((prev) => ({ ...prev, city: "", barangay: "" }));
    setBarangays([]);
  }, [formData.province, provinces]);

  // City -> Barangays
  useEffect(() => {
    const selectedCity = cities.find((c) => c.city_name === formData.city);
    setBarangays(selectedCity ? selectedCity.barangays || [] : []);
    setFormData((prev) => ({ ...prev, barangay: "" }));
  }, [formData.city, cities]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://127.0.0.1:8080/api/warehouses/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(
          `Warehouse '${formData.name}' has been saved successfully!`,
          { style: successStyle }
        );
        onSuccess();
      } else {
        console.error("Failed to create warehouse");
      }
    } catch (error) {
      console.error("Error creating warehouse:", error);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">New Warehouse</h2>
      <form onSubmit={handleSubmit}>
        {/* Name */}
        <div className="mb-3">
          <label className="block font-medium">Name of Warehouse</label>
          <input
            type="text"
            name="name"
            className="w-full border p-2 rounded"
            required
            onChange={handleChange}
          />
        </div>

        {/* Country */}
        <div className="mb-3">
          <label className="block font-medium">Country</label>
          <input
            type="text"
            name="country"
            value="Philippines"
            disabled
            className="w-full border p-2 rounded bg-gray-100"
          />
        </div>

        {/* Region */}
        <div className="mb-3">
          <label className="block font-medium">Region</label>
          <select
            name="region"
            value={formData.region}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          >
            <option value="">-- Select Region --</option>
            {psgcData.map((region) => (
              <option key={region.region_name} value={region.region_name}>
                {region.region_name}
              </option>
            ))}
          </select>
        </div>

        {/* Province */}
        <div className="mb-3">
          <label className="block font-medium">Province</label>
          <select
            name="province"
            value={formData.province}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            disabled={!formData.region}
          >
            <option value="">-- Select Province --</option>
            {provinces.map((prov) => (
              <option key={prov.province_name} value={prov.province_name}>
                {prov.province_name}
              </option>
            ))}
          </select>
        </div>

        {/* City */}
        <div className="mb-3">
          <label className="block font-medium">City/Municipality</label>
          <select
            name="city"
            value={formData.city}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            disabled={!formData.province}
          >
            <option value="">-- Select City/Municipality --</option>
            {cities.map((city) => (
              <option key={city.city_name} value={city.city_name}>
                {city.city_name}
              </option>
            ))}
          </select>
        </div>

        {/* Barangay */}
        <div className="mb-3">
          <label className="block font-medium">Barangay</label>
          <select
            name="barangay"
            value={formData.barangay}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            disabled={!formData.city}
          >
            <option value="">-- Select Barangay --</option>
            {barangays.map((bgy, idx) => (
              <option key={idx} value={bgy}>
                {bgy}
              </option>
            ))}
          </select>
        </div>

        {/* Street Address ✅ */}
        <div className="mb-3">
          <label className="block font-medium">Street Address</label>
          <input
            type="text"
            name="street_address"
            className="w-full border p-2 rounded"
            required
            onChange={handleChange}
          />
        </div>

        {/* Zip */}
        <div className="mb-3">
          <label className="block font-medium">Zip Code</label>
          <input
            type="text"
            name="zip_code"
            className="w-full border p-2 rounded"
            required
            onChange={handleChange}
          />
        </div>

        {/* Phone */}
        <div className="mb-3">
          <label className="block font-medium">Phone No.</label>
          <input
            type="text"
            name="phone_number"
            className="w-full border p-2 rounded"
            required
            onChange={handleChange}
          />
        </div>

        {/* Email */}
        <div className="mb-3">
          <label className="block font-medium">Email</label>
          <input
            type="email"
            name="email"
            className="w-full border p-2 rounded"
            required
            onChange={handleChange}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-between">
          <button
            type="button"
            className="btn-cancel py-2 px-4 rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-blue-500 text-white py-2 px-4 rounded"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default WarehouseForm;
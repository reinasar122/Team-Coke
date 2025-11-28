import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { successStyle, errorStyle } from "../utils/toastStyles";
import psgcData from "../data/psgc_output.json";
import { validatePhoneNumber, validateZipCode } from "../utils/validators";
import api from "../api"; // ✅ Use centralized API instance

const WarehouseForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    country: "Philippines",
    region: "",
    province: "",
    city: "",
    barangay: "",
    street_address: "",
    zip_code: "",
    phone_number: "",
    email: "",
  });

  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [errors, setErrors] = useState({
    phone_number: null,
    zip_code: null,
    email: null,
  });

  // ✅ Cascading PSGC dropdowns
  useEffect(() => {
    const selectedRegion = psgcData.find((r) => r.region_name === formData.region);
    setProvinces(selectedRegion ? selectedRegion.provinces : []);
    setFormData((prev) => ({ ...prev, province: "", city: "", barangay: "" }));
    setCities([]);
    setBarangays([]);
  }, [formData.region]);

  useEffect(() => {
    const selectedProvince = provinces.find((p) => p.province_name === formData.province);
    setCities(selectedProvince ? selectedProvince.cities || [] : []);
    setFormData((prev) => ({ ...prev, city: "", barangay: "" }));
    setBarangays([]);
  }, [formData.province, provinces]);

  useEffect(() => {
    const selectedCity = cities.find((c) => c.city_name === formData.city);
    setBarangays(selectedCity ? selectedCity.barangays || [] : []);
    setFormData((prev) => ({ ...prev, barangay: "" }));
  }, [formData.city, cities]);

  // ✅ Handle change with live validation
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "phone_number") {
      const err = validatePhoneNumber(value);
      setErrors((prev) => ({ ...prev, phone_number: err }));
    }

    if (name === "zip_code") {
      const err = validateZipCode(value);
      setErrors((prev) => ({ ...prev, zip_code: err }));
    }

    if (name === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const err = !emailRegex.test(value)
        ? "Please enter a valid email address."
        : null;
      setErrors((prev) => ({ ...prev, email: err }));
    }
  };

  // ✅ Validate inputs
  const validateInputs = () => {
    const phoneError = validatePhoneNumber(formData.phone_number);
    const zipError = validateZipCode(formData.zip_code);

    if (phoneError) {
      toast.error(phoneError, { style: errorStyle });
      return false;
    }

    if (zipError) {
      toast.error(zipError, { style: errorStyle });
      return false;
    }

    if (errors.email) {
      toast.error(errors.email, { style: errorStyle });
      return false;
    }

    return true;
  };

  // ✅ NEW: Warehouse creation notification helper
  const notifyWarehouseCreated = (warehouseData) => {
    console.log("🏭 Notifying warehouse creation:", warehouseData);
    
    const event = new CustomEvent('warehouseCreated', {
      detail: {
        action: 'created',
        warehouseId: warehouseData.id,
        warehouseName: warehouseData.name,
        warehouse_id: warehouseData.id,
        name: warehouseData.name,
        address: `${warehouseData.street_address}, ${warehouseData.barangay}, ${warehouseData.city}, ${warehouseData.province}`,
        phone: warehouseData.phone_number,
        email: warehouseData.email,
        createdBy: JSON.parse(localStorage.getItem("user") || "{}").username || 'Admin',
        timestamp: new Date().toISOString(),
        summary: `New warehouse "${warehouseData.name}" has been created`
      }
    });
    
    window.dispatchEvent(event);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateInputs()) return;

    try {
      const res = await api.post("/warehouses/", formData); // ✅ Use centralized API call

      // ✅ NEW: Get the created warehouse data
      const warehouseData = res.data;
        
      toast.success(`Warehouse '${formData.name}' has been saved successfully!`, {
        style: successStyle,
      });
      
      // ✅ NEW: Trigger warehouse creation notification
      notifyWarehouseCreated(warehouseData);
      console.log(`🏭 Warehouse creation notification sent for: ${warehouseData.name}`);
        
      onSuccess?.();
      onClose?.();
    } catch (error) {
      console.error("Error creating warehouse:", error);
      toast.error("Failed to create warehouse. Please check the fields.", {
        style: errorStyle,
      });
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">New Warehouse</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div className="md:col-span-2">
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
        <div>
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
        <div>
          <label className="block font-medium">Region</label>
          <select
            name="region"
            value={formData.region}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          >
            <option value="">Select Region</option>
            {psgcData.map((region) => (
              <option key={region.region_name} value={region.region_name}>
                {region.region_name}
              </option>
            ))}
          </select>
        </div>

        {/* Province */}
        <div>
          <label className="block font-medium">Province/District</label>
          <select
            name="province"
            value={formData.province}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            disabled={!formData.region}
          >
            <option value="">Select Province</option>
            {provinces.map((prov) => (
              <option key={prov.province_name} value={prov.province_name}>
                {prov.province_name}
              </option>
            ))}
          </select>
        </div>

        {/* City */}
        <div>
          <label className="block font-medium">City/Municipality</label>
          <select
            name="city"
            value={formData.city}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            disabled={!formData.province}
          >
            <option value="">Select City/Municipality</option>
            {cities.map((city) => (
              <option key={city.city_name} value={city.city_name}>
                {city.city_name}
              </option>
            ))}
          </select>
        </div>

        {/* Barangay */}
        <div>
          <label className="block font-medium">Barangay</label>
          <select
            name="barangay"
            value={formData.barangay}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            disabled={!formData.city}
          >
            <option value="">Select Barangay</option>
            {barangays.map((bgy, idx) => (
              <option key={idx} value={bgy}>
                {bgy}
              </option>
            ))}
          </select>
        </div>

        {/* Zip Code */}
        <div>
          <label className="block font-medium">Zip Code</label>
          <input
            type="text"
            name="zip_code"
            className={`w-full border p-2 rounded ${
              errors.zip_code ? "border-red-500" : ""
            }`}
            required
            onChange={handleChange}
          />
          {errors.zip_code && (
            <p className="text-red-500 text-sm mt-1">{errors.zip_code}</p>
          )}
        </div>

        {/* Street Address */}
        <div className="md:col-span-2">
          <label className="block font-medium">Street Address</label>
          <input
            type="text"
            name="street_address"
            className="w-full border p-2 rounded"
            required
            onChange={handleChange}
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block font-medium">Phone No.</label>
          <input
            type="text"
            name="phone_number"
            className={`w-full border p-2 rounded ${
              errors.phone_number ? "border-red-500" : ""
            }`}
            required
            onChange={handleChange}
          />
          {errors.phone_number && (
            <p className="text-red-500 text-sm mt-1">{errors.phone_number}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block font-medium">Email</label>
          <input
            type="email"
            name="email"
            className={`w-full border p-2 rounded ${
              errors.email ? "border-red-500" : ""
            }`}
            required
            onChange={handleChange}
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email}</p>
          )}
        </div>

        {/* Buttons */}
        <div className="md:col-span-2 flex justify-between mt-4">
          <button type="button" className="btn btn-cancel py-2 px-4" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary py-2 px-4">
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default WarehouseForm;

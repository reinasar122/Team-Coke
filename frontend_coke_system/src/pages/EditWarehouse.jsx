import React, { useEffect, useState } from "react";
import psgcData from "../data/psgc_output.json";
import { toast } from "react-toastify";
import { successStyle, errorStyle } from "../utils/toastStyles";
import { validatePhoneNumber, validateZipCode } from "../utils/validators";

const EditWarehouse = ({ id, onClose, onSuccess }) => {
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

  // ✅ Live validation errors
  const [errors, setErrors] = useState({
    phone_number: null,
    zip_code: null,
    email: null,
  });

  // ✅ Fetch warehouse data
  useEffect(() => {
    const fetchWarehouse = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8080/api/warehouses/${id}/`);
        const data = await res.json();
        setFormData(data);
      } catch (error) {
        console.error("Error fetching warehouse:", error);
        toast.error("Failed to load warehouse details.", { style: errorStyle });
      }
    };
    fetchWarehouse();
  }, [id]);

  // ✅ PSGC cascading logic
  useEffect(() => {
    const selectedRegion = psgcData.find(
      (r) => r.region_name === formData.region
    );
    setProvinces(selectedRegion ? selectedRegion.provinces : []);

    const selectedProvince = selectedRegion?.provinces.find(
      (p) => p.province_name === formData.province
    );
    setCities(selectedProvince ? selectedProvince.cities : []);

    const selectedCity = selectedProvince?.cities.find(
      (c) => c.city_name === formData.city
    );
    setBarangays(selectedCity ? selectedCity.barangays : []);
  }, [formData.region, formData.province, formData.city]);

  // ✅ Handle field changes with live validation
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      if (name === "region")
        return { ...prev, region: value, province: "", city: "", barangay: "" };
      if (name === "province")
        return { ...prev, province: value, city: "", barangay: "" };
      if (name === "city") return { ...prev, city: value, barangay: "" };
      return { ...prev, [name]: value };
    });

    // Live validation logic
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

  // ✅ Validate before saving
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

  // ✅ Submit updated warehouse
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateInputs()) return;

    try {
      const res = await fetch(`http://127.0.0.1:8080/api/warehouses/${id}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(
          `Warehouse '${formData.name}' has been updated successfully!`,
          { style: successStyle }
        );
        onSuccess?.();
        onClose?.();
      } else {
        const data = await res.json();
        if (data && typeof data === "object") {
          const firstKey = Object.keys(data)[0];
          const firstErr = Array.isArray(data[firstKey])
            ? data[firstKey][0]
            : data[firstKey];
          toast.error(`${firstKey}: ${firstErr}`, { style: errorStyle });
        } else {
          toast.error("Failed to update warehouse. Please check the fields.", {
            style: errorStyle,
          });
        }
      }
    } catch (error) {
      console.error("Error updating warehouse:", error);
      toast.error("Failed to update warehouse.", { style: errorStyle });
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Edit Warehouse</h2>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* Name */}
        <div className="md:col-span-2">
          <label className="block font-medium">Name of Warehouse</label>
          <input
            type="text"
            name="name"
            value={formData.name || ""}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
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
            value={formData.region || ""}
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
        <div>
          <label className="block font-medium">Province/District</label>
          <select
            name="province"
            value={formData.province || ""}
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
        <div>
          <label className="block font-medium">City/Municipality</label>
          <select
            name="city"
            value={formData.city || ""}
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
        <div>
          <label className="block font-medium">Barangay</label>
          <select
            name="barangay"
            value={formData.barangay || ""}
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

        {/* Zip Code */}
        <div>
          <label className="block font-medium">Zip Code</label>
          <input
            type="text"
            name="zip_code"
            value={formData.zip_code || ""}
            onChange={handleChange}
            className={`w-full border p-2 rounded ${
              errors.zip_code ? "border-red-500" : ""
            }`}
            required
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
            value={formData.street_address || ""}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block font-medium">Phone No.</label>
          <input
            type="text"
            name="phone_number"
            value={formData.phone_number || ""}
            onChange={handleChange}
            className={`w-full border p-2 rounded ${
              errors.phone_number ? "border-red-500" : ""
            }`}
            required
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
            value={formData.email || ""}
            onChange={handleChange}
            className={`w-full border p-2 rounded ${
              errors.email ? "border-red-500" : ""
            }`}
            required
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email}</p>
          )}
        </div>

        {/* Buttons */}
        <div className="md:col-span-2 flex justify-between mt-4">
          <button
            type="button"
            className="btn btn-cancel py-2 px-4"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary py-2 px-4">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditWarehouse;
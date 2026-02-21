// src/pages/SupplierRegistrationForm.jsx
import React, { useState, useEffect } from "react";
import api from "../api"; // ✅ centralized API instance
//import psgcData from "../data/psgc_output.json";
import psgcData from "../data/updated_psgc_output.json";
import { toast } from "react-toastify";
import { successStyle, errorStyle } from "../utils/toastStyles";
import { validatePhoneNumber} from "../utils/validators";

const SupplierRegistrationForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    company_name: "",
    bir_no: "",
    contact_person: "",
    email: "",
    phone_number: "",
    country: "Philippines",
    region: "",
    province: "",
    city: "",
    barangay: "",
    street_address: "",
    zip_code: "",
    contacts: [],
  });

  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [errors, setErrors] = useState({});


  const [newContact, setNewContact] = useState({
    contact_person: "",
    email: "",
    phone_number: "",
  });

  const [contactErrors, setContactErrors] = useState({
    contact_person: null,
    email: null,
    phone_number: null,
  });

  // Map municipality names to zip codes
  const zipCodeMap = new Map();
  psgcData.forEach(region => {
    region.provinces.forEach(province => {
      province.cities.forEach(city => {
        // Assuming the zip code is already in the city's data
        zipCodeMap.set(city.city_name.toLowerCase(), city.zip_code);
      });
    });
  });

  
  useEffect(() => {
    setFormData((prev) => {
      // If region already set (e.g., when editing), do nothing
      if (prev.region) return prev;

      // Find Region VII (Central Visayas) in PSGC data
      const defaultRegion = psgcData.find((r) =>
        r.region_name.toLowerCase().includes("central visayas")
      );

      if (defaultRegion) {
        return {
          ...prev,
          region: defaultRegion.region_name, // exact text from JSON
        };
      }

      return prev;
    });
  }, []);


  // ✅ PSGC cascading dropdowns
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

  // ✅ Handle change with live validation
  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextValue =
      name === "phone_number" ? value.replace(/\D/g, "").slice(0, 11) : value;

    setFormData((prev) => {
      if (name === "region")
        return { ...prev, region: nextValue, province: "", city: "", barangay: "" };
      if (name === "province")
        return { ...prev, province: nextValue, city: "", barangay: "" };
      if (name === "city") return { ...prev, city: nextValue, barangay: "" };
      return { ...prev, [name]: nextValue };
    });

    if (name === "phone_number") {
      const err = validatePhoneNumber(nextValue);
      setErrors((prev) => ({ ...prev, phone_number: err }));
    }
  };

  const handleNewContactChange = (e) => {
    const { name, value } = e.target;
    const nextValue =
      name === "phone_number" ? value.replace(/\D/g, "").slice(0, 11) : value;
    setNewContact((prev) => ({ ...prev, [name]: nextValue }));

    // Live validation feedback
    if (name === "phone_number") {
      const err = validatePhoneNumber(nextValue);
      setContactErrors((prev) => ({ ...prev, phone_number: err }));
    }

    if (name === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const err = !emailRegex.test(nextValue) ? "Please enter a valid email address." : null;
      setContactErrors((prev) => ({ ...prev, email: err }));
    }

    if (name === "contact_person") {
      const err = nextValue.trim() ? null : "Contact person is required.";
      setContactErrors((prev) => ({ ...prev, contact_person: err }));
    }
  };

  // ✅ Add contact with validation
  const addContact = () => {
    const { contact_person, email, phone_number } = newContact;

    // Final check before adding
    const phoneError = validatePhoneNumber(phone_number);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailError = !emailRegex.test(email) ? "Please enter a valid email address." : null;

    const errors = {
      contact_person: contact_person.trim() ? null : "Contact person is required.",
      email: emailError,
      phone_number: phoneError,
    };
    setContactErrors(errors);

    if (errors.contact_person || errors.email || errors.phone_number) {
      toast.error("Please fix the errors before adding.", { style: errorStyle });
      return;
    }

    // ✅ Prevent duplicates
    const duplicate = formData.contacts.some(
      (c) =>
        c.email.toLowerCase() === email.toLowerCase() ||
        c.phone_number === phone_number
    );
    if (duplicate) {
      toast.error("This contact already exists.", { style: errorStyle });
      return;
    }

    // ✅ Add valid contact
    setFormData((prev) => ({
      ...prev,
      contacts: [...prev.contacts, newContact],
    }));

    toast.success("Additional contact added.", { style: successStyle });
    setNewContact({ contact_person: "", email: "", phone_number: "" });
    setContactErrors({ contact_person: null, email: null, phone_number: null });
  };

  const removeContact = (index) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index),
    }));
  };

  // ✅ Validate before submit
  const validateMainFields = () => {
    const phoneError = validatePhoneNumber(formData.phone_number);

    setErrors({
      phone_number: phoneError,
    });

    if (phoneError) {
      toast.error(phoneError, { style: errorStyle });
      return false;
    }

    return true;
  };

  // ✅ Submit form (Create supplier) with notification dispatch
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateMainFields()) return;

    const payload = {
      ...formData,
      contacts: formData.contacts.map((c) => ({
        contact_person: c.contact_person?.trim(),
        email: c.email?.trim(),
        phone_number: c.phone_number?.trim(),
      })),
    };

    try {
      const response = await api.post("/suppliers/", payload); // ✅ use centralized API call
      
      // ✅ NEW: Dispatch supplier creation event for notifications
      if (response.data) {
        // Get current user and warehouse info
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
        const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
        
        let warehouseId;
        if (userData.role?.toLowerCase() === "admin") {
          warehouseId = selectedWarehouse?.id || userData.warehouse_id;
        } else {
          warehouseId = userData.warehouse_id;
        }
        
        // Dispatch notification event
        const supplierEvent = new CustomEvent('supplierCreated', {
          detail: {
            action: 'created',
            supplierId: response.data.id,
            supplierName: response.data.company_name || payload.company_name,
            contactNumber: response.data.phone_number || payload.phone_number,
            address: `${payload.street_address}, ${payload.barangay}, ${payload.city}, ${payload.province}`,
            email: response.data.email || payload.email,
            warehouseId: warehouseId,
            warehouse_id: warehouseId,
            createdBy: userData.username || userData.name || 'User'
          }
        });
        window.dispatchEvent(supplierEvent);
        
        console.log('🏪 Supplier creation notification dispatched for warehouse:', warehouseId);
      }
      
      toast.success("Supplier successfully added!", { style: successStyle });
      onSuccess?.();
      onClose?.();
    } catch (error) {
      const data = error.response?.data;
      if (data && typeof data === "object") {
        const firstKey = Object.keys(data)[0];
        const firstErr = Array.isArray(data[firstKey])
          ? data[firstKey][0]
          : data[firstKey];
        toast.error(`${firstKey}: ${firstErr}`, { style: errorStyle });
      } else {
        toast.error("Failed to register supplier.", { style: errorStyle });
      }
      console.error("Supplier registration error:", data || error.message);
    }
  };

  // Set zip code when municipality is selected
  useEffect(() => {
    if (!formData.city) {
      setFormData((prev) => ({
        ...prev,
        zip_code: "",
      }));
      return;
    }

    const selectedRegion = psgcData.find(
      (r) => r.region_name === formData.region
    );

    if (selectedRegion) {
      const selectedProvince = selectedRegion.provinces.find(
        (p) => p.province_name === formData.province
      );

      if (selectedProvince) {
        const selectedCity = selectedProvince.cities.find(
          (c) => c.city_name === formData.city
        );

        if (selectedCity) {
          setFormData((prev) => ({
            ...prev,
            zip_code: selectedCity.zip_code || "",
          }));
        }
      }
    }
  }, [formData.city, formData.province, formData.region]);

  return (
    <div className="container p-4">
      <h2 className="text-2xl font-bold border-l-4 border-blue-500 pl-2 mb-4">
        New Supplier Registration
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Company Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium">Company Name</label>
            <input
              type="text"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block font-medium">Tax Identification No.</label>
            <input
              type="text"
              name="bir_no"
              value={formData.bir_no}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
          </div>
        </div>

        {/* Primary Contact */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block font-medium">Contact Person</label>
            <input
              type="text"
              name="contact_person"
              value={formData.contact_person}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block font-medium">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block font-medium">Phone Number</label>
            <input
              type="text"
              name="phone_number"
              inputMode="numeric"
              pattern="[0-9]*"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={11}
              value={formData.phone_number}
              onChange={handleChange}
              className={`w-full border p-2 rounded ${
                errors.phone_number ? "border-red-500" : ""
              }`}
              required
            />
            {errors.phone_number && (
              <p className="text-red-500 text-sm mt-1">
                {errors.phone_number}
              </p>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          <div className="md:col-span-2">
            <label className="block font-medium">Street Address</label>
            <input
              type="text"
              name="street_address"
              value={formData.street_address}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block font-medium">Country</label>
            <input
              type="text"
              name="country"
              value={formData.country}
              disabled
              className="w-full border p-2 rounded bg-gray-100"
            />
          </div>
          <div>
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
          <div>
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
              {provinces.map((p) => (
                <option key={p.province_name} value={p.province_name}>
                  {p.province_name}
                </option>
              ))}
            </select>
          </div>
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
              <option value="">-- Select City/Municipality --</option>
              {cities.map((c) => (
                <option key={c.city_name} value={c.city_name}>
                  {c.city_name}
                </option>
              ))}
            </select>
          </div>
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
              <option value="">-- Select Barangay --</option>
              {barangays.map((b, idx) => (
                <option key={idx} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium">Zip Code</label>
            <input
              type="text"
              name="zip_code"
              className={`w-full border p-2 rounded ${errors.zip_code ? "border-red-500" : ""}`}
              required
              value={formData.zip_code}  // Bind the value to formData.zip_code
              onChange={handleChange}
            />
            {errors.zip_code && (
              <p className="text-red-500 text-sm mt-1">{errors.zip_code}</p>
            )}
          </div>

          
        </div>

        {/* Additional Contacts */}
        <div className="mt-4">
          <h3 className="font-semibold mb-2">
            Additional Contact Person{" "}
            {formData.contacts.length > 0 && (
              <span className="ml-2 text-sm text-gray-500">
                ({formData.contacts.length} added)
              </span>
            )}
          </h3>

          {formData.contacts.map((c, idx) => (
            <div
              key={`${c.email}-${idx}`}
              className="border p-2 mb-2 flex justify-between items-center rounded"
            >
              <span className="text-sm">
                {c.contact_person} — {c.email} — {c.phone_number}
              </span>
              <button
                type="button"
                onClick={() => removeContact(idx)}
                className="bg-red-500 text-white px-2 py-1 rounded"
              >
                Remove
              </button>
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <div>
              <input
                type="text"
                name="contact_person"
                placeholder="Contact Person"
                value={newContact.contact_person}
                onChange={handleNewContactChange}
                className={`w-full border p-2 rounded ${
                  contactErrors.contact_person ? "border-red-500" : ""
                }`}
              />
              {contactErrors.contact_person && (
                <p className="text-red-500 text-sm mt-1">{contactErrors.contact_person}</p>
              )}
            </div>

            <div>
              <input
                type="email"
                name="email"
                placeholder="Email (optional)"
                value={newContact.email}
                onChange={handleNewContactChange}
                className={`w-full border p-2 rounded ${
                  contactErrors.email ? "border-red-500" : ""
                }`}
              />
              {contactErrors.email && (
                <p className="text-red-500 text-sm mt-1">{contactErrors.email}</p>
              )}
            </div>

            <div>
              <input
                type="text"
                name="phone_number"
                placeholder="Phone Number"
                inputMode="numeric"
                pattern="[0-9]*"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={11}
                value={newContact.phone_number}
                onChange={handleNewContactChange}
                className={`w-full border p-2 rounded ${
                  contactErrors.phone_number ? "border-red-500" : ""
                }`}
              />
              {contactErrors.phone_number && (
                <p className="text-red-500 text-sm mt-1">{contactErrors.phone_number}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={addContact}
            className="btn btn-add mt-4"
            disabled={
              !newContact.contact_person ||
              !newContact.email ||
              !newContact.phone_number
            }
          >
            Add Contact
          </button>
        </div>

        {/* Actions */}
       <div className="md:col-span-2 flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-cancel px-4 py-2"
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary px-4 py-2">
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};

export default SupplierRegistrationForm;

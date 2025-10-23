import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { successStyle, errorStyle } from "../utils/toastStyles";
import psgcData from "../data/psgc_output.json";
import api from "../api"; // ✅ correct

const SupplierRegistrationForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    company_name: "",
    bir_no: "",
    contact_person: "",
    email: "",
    phone_number: "",
    // Address (PSGC)
    country: "Philippines",
    region: "",
    province: "",
    city: "",
    barangay: "",
    street_address: "",   
    zip_code: "",
    contacts: [],
  });

  const [newContact, setNewContact] = useState({
    contact_person: "",
    email: "",
    phone_number: "",
  });

  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  // PSGC cascade (Region -> Province -> City -> Barangay)
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    // reset deeper levels in the cascade
    setFormData((prev) => {
      if (name === "region") {
        return { ...prev, region: value, province: "", city: "", barangay: "" };
      }
      if (name === "province") {
        return { ...prev, province: value, city: "", barangay: "" };
      }
      if (name === "city") {
        return { ...prev, city: value, barangay: "" };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleNewContactChange = (e) => {
    const { name, value } = e.target;
    setNewContact((c) => ({ ...c, [name]: value }));
  };

  const addContact = () => {
    const { contact_person, email, phone_number } = newContact;
    if (!contact_person || !email || !phone_number) return;
    setFormData((prev) => ({
      ...prev,
      contacts: [...prev.contacts, newContact],
    }));
    setNewContact({ contact_person: "", email: "", phone_number: "" });
  };

  const removeContact = (index) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Build payload exactly as backend expects
    const payload = {
      company_name: formData.company_name?.trim(),
      bir_no: formData.bir_no?.trim() || undefined,
      contact_person: formData.contact_person?.trim(),
      email: formData.email?.trim(),
      phone_number: formData.phone_number?.trim(),
      country: formData.country,
      region: formData.region,
      province: formData.province,
      city: formData.city,
      barangay: formData.barangay,
      street_address: formData.street_address?.trim(), // required
      zip_code: formData.zip_code?.trim(),
      contacts: formData.contacts, // [{ contact_person, email, phone_number }, ...]
    };

    try {
      await api.post("/suppliers/", payload);

      toast.success(
        `Supplier '${formData.company_name || "New Supplier"}' has been registered successfully!`,
        { style: successStyle }
      );

      onSuccess?.(); // parent can refresh table
      onClose?.();   // close modal
    } catch (error) {
      const data = error.response?.data;
      if (data && typeof data === "object") {
        const firstKey = Object.keys(data)[0];
        const firstErr = Array.isArray(data[firstKey]) ? data[firstKey][0] : data[firstKey];
        toast.error(`${firstKey}: ${firstErr}`, { style: errorStyle });
      } else {
        toast.error("Failed to register supplier. Please check the fields and try again.", {
          style: errorStyle,
        });
      }
      console.error("Supplier create error:", data || error.message);
    }
  };

  return (
    <div className="modal-over ">
      <h2 className="text-2xl font-bold mb-4">
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
            <label className="block font-medium">BIR No.</label>
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
              value={formData.phone_number}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            />
          </div>
        </div>

        {/* Address (PSGC) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              {provinces.map((prov) => (
                <option key={prov.province_name} value={prov.province_name}>
                  {prov.province_name}
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
              {barangays.map((bgy, idx) => (
                <option key={`${bgy}-${idx}`} value={bgy}>
                  {bgy}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium">Zip Code</label>
            <input
              type="text"
              name="zip_code"
              value={formData.zip_code}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-medium">Street </label>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                name="street_address"
                value={formData.street_address}
                onChange={handleChange}
                className="w-full md:flex-1 border p-2 rounded"
                required
                placeholder="House No., Street"
              />
              </div>
          </div>

          
        </div>

        {/* Additional Contacts */}
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Additional Contacts</h3>

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
            <input
              type="text"
              name="contact_person"
              placeholder="Contact Person"
              value={newContact.contact_person}
              onChange={handleNewContactChange}
              className="w-full border p-2 rounded"
            />
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={newContact.email}
              onChange={handleNewContactChange}
              className="w-full border p-2 rounded"
            />
            <input
              type="text"
              name="phone_number"
              placeholder="Phone Number"
              value={newContact.phone_number}
              onChange={handleNewContactChange}
              className="w-full border p-2 rounded"
            />
          </div>
          <button
            type="button"
            onClick={addContact}
            className="btn btn-add mt-4"
          >
            Add Contact
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-back"
          >
            Back
          </button>
          <button
            type="submit"
            className="btn btn-primary"
          >
            Submit Registration
          </button>
        </div>
      </form>
    </div>
  );
};

export default SupplierRegistrationForm;
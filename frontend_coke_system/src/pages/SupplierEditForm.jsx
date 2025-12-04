// src/pages/SupplierEditForm.jsx
import React, { useState, useEffect } from "react";
import api from "../api"; // ✅ centralized API instance
import psgcData from "../data/psgc_output.json";
import { toast } from "react-toastify";
import { successStyle, errorStyle } from "../utils/toastStyles";
import { validatePhoneNumber, validateZipCode } from "../utils/validators";

const SupplierEditForm = ({ supplierId, onClose, onSuccess }) => {
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

  const [errors, setErrors] = useState({ phone_number: null, zip_code: null });
  const [contactErrors, setContactErrors] = useState({
    contact_person: null,
    email: null,
    phone_number: null,
  });

  const [newContact, setNewContact] = useState({
    contact_person: "",
    email: "",
    phone_number: "",
  });

  // ✅ Fetch Supplier Data
  useEffect(() => {
    const loadSupplier = async () => {
      try {
        const { data } = await api.get(`/suppliers/${supplierId}/`); // ✅ use centralized API call
        setFormData({
          ...data,
          street_address: data.street_address ?? data.street ?? "",
          country: data.country ?? "Philippines",
          contacts: data.contacts || [],
        });
      } catch (error) {
        console.error("Error fetching supplier:", error);
        toast.error("Failed to load supplier details.", { style: errorStyle });
      }
    };
    if (supplierId) loadSupplier();
  }, [supplierId]);

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

  // ✅ Handle field changes (with live validation)
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

    // Live validations
    if (name === "phone_number") {
      const err = validatePhoneNumber(value);
      setErrors((prev) => ({ ...prev, phone_number: err }));
    }

    if (name === "zip_code") {
      const err = validateZipCode(value);
      setErrors((prev) => ({ ...prev, zip_code: err }));
    }
  };

  // ✅ Handle Additional Contact Input (with live validation)
  const handleNewContactChange = (e) => {
    const { name, value } = e.target;
    setNewContact((prev) => ({ ...prev, [name]: value }));

    if (name === "phone_number") {
      const err = validatePhoneNumber(value);
      setContactErrors((prev) => ({ ...prev, phone_number: err }));
    }

    if (name === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const err = !emailRegex.test(value)
        ? "Please enter a valid email address."
        : null;
      setContactErrors((prev) => ({ ...prev, email: err }));
    }

    if (name === "contact_person") {
      const err = value.trim() ? null : "Contact person is required.";
      setContactErrors((prev) => ({ ...prev, contact_person: err }));
    }
  };

  // ✅ Add contact with same validation rules
  const addContact = () => {
    const { contact_person, email, phone_number } = newContact;

    const phoneError = validatePhoneNumber(phone_number);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailError = !emailRegex.test(email)
      ? "Please enter a valid email address."
      : null;

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

    const duplicate = formData.contacts.some(
      (c) =>
        c.email.toLowerCase() === email.toLowerCase() ||
        c.phone_number === phone_number
    );
    if (duplicate) {
      toast.error("This contact already exists.", { style: errorStyle });
      return;
    }

    setFormData((prev) => ({
      ...prev,
      contacts: [...prev.contacts, newContact],
    }));
    toast.success("Additional contact added.", { style: successStyle });
    setNewContact({ contact_person: "", email: "", phone_number: "" });
    setContactErrors({ contact_person: null, email: null, phone_number: null });
  };

  // ✅ Remove contact
  const removeContact = (index) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index),
    }));
  };

  // ✅ Validate before saving
  const validateMainFields = () => {
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
    return true;
  };

  // ✅ Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateMainFields()) return;

    const contactsData = formData.contacts.map((c) => ({
      id: c.id || undefined,
      contact_person: c.contact_person?.trim(),
      email: c.email?.trim(),
      phone_number: c.phone_number?.trim(),
    }));

    const payload = {
      ...formData,
      contacts: contactsData,
    };

    try {
      await api.put(`/suppliers/${supplierId}/`, payload); // ✅ use centralized API call
      toast.success(
        `Supplier '${formData.company_name}' has been successfully updated!`,
        { style: successStyle }
      );
      onSuccess?.();
      onClose?.();
    } catch (error) {
      const data = error.response?.data;
      console.error("Supplier update error:", data || error.message);
      toast.error("Failed to update supplier. Please check the fields.", {
        style: errorStyle,
      });
    }
  };

  return (
    <div className="container p-4">
      <h2 className="text-2xl font-bold border-l-4 border-blue-500 pl-2 mb-4">
        Edit Supplier
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
            <label className="block font-medium">TIN No.</label>
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
              className={`w-full border p-2 rounded ${
                errors.phone_number ? "border-red-500" : ""
              }`}
              required
            />
            {errors.phone_number && (
              <p className="text-red-500 text-sm mt-1">{errors.phone_number}</p>
            )}
          </div>
        </div>

        {/* Address Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium">Country</label>
            <input
              type="text"
              value="Philippines"
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
              {psgcData.map((r) => (
                <option key={r.region_name} value={r.region_name}>
                  {r.region_name}
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
              {barangays.map((b, i) => (
                <option key={i} value={b}>
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
              value={formData.zip_code}
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
        </div>

        {/* Additional Contacts */}
        <div className="mt-4">
          <h3 className="font-semibold mb-2">
            Additional Contacts{" "}
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
                <p className="text-red-500 text-sm mt-1">
                  {contactErrors.contact_person}
                </p>
              )}
            </div>
            <div>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={newContact.email}
                onChange={handleNewContactChange}
                className={`w-full border p-2 rounded ${
                  contactErrors.email ? "border-red-500" : ""
                }`}
              />
              {contactErrors.email && (
                <p className="text-red-500 text-sm mt-1">
                  {contactErrors.email}
                </p>
              )}
            </div>
            <div>
              <input
                type="text"
                name="phone_number"
                placeholder="Phone Number"
                value={newContact.phone_number}
                onChange={handleNewContactChange}
                className={`w-full border p-2 rounded ${
                  contactErrors.phone_number ? "border-red-500" : ""
                }`}
              />
              {contactErrors.phone_number && (
                <p className="text-red-500 text-sm mt-1">
                  {contactErrors.phone_number}
                </p>
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
        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-cancel px-4 py-2"
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary px-4 py-2">
            Update Supplier
          </button>
        </div>
      </form>
    </div>
  );
};

export default SupplierEditForm;

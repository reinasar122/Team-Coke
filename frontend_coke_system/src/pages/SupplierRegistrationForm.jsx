import React, { useState } from "react";
import axios from "axios";

const SupplierRegistrationForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    company_name: "",
    registration_number: "",
    bir_no: "",
    contact_person: "",
    email: "",
    phone_number: "",
    street_address: "",
    city: "",
    region: "",
    zip_code: "",
    additionalContacts: [],
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleAddContact = () => {
    setFormData((prevData) => ({
      ...prevData,
      additionalContacts: [
        ...prevData.additionalContacts,
        { contactPerson: "", email: "", phoneNumber: "" },
      ],
    }));
  };

  const handleContactChange = (index, e) => {
    const { name, value } = e.target;
    setFormData((prevData) => {
      const updatedContacts = [...prevData.additionalContacts];
      updatedContacts[index] = { ...updatedContacts[index], [name]: value };
      return { ...prevData, additionalContacts: updatedContacts };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formattedData = {
        ...formData,
        contacts: formData.additionalContacts.map(contact => ({
          contact_person: contact.contactPerson,
          email: contact.email,
          phone_number: contact.phoneNumber
        }))
      };
  
      const response = await axios.post("http://localhost:8000/api/suppliers/", formattedData);
      console.log("Supplier Registered:", response.data);
    } catch (error) {
      console.error("Error registering supplier:", error);
    }
  };
  

  const handleClear = () => {
    setFormData({
      company_name: "",
      registration_number: "",
      bir_no: "",
      contact_person: "",
      email: "",
      phone_number: "",
      street_address: "",
      city: "",
      region: "",
      zip_code: "",
      additionalContacts: [],
    });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-red-600 mb-4 border-l-4 pl-2 border-red-600">
        Supplier Registration
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Company Information */}
        <div>
          <h2 className="text-lg font-semibold">Company Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              placeholder="Company Name"
              required
              className="border px-3 py-2 rounded-md"
            />
          
            <input
              type="text"
              name="bir_no"
              value={formData.bir_no}
              onChange={handleChange}
              placeholder="BIR NO."
              className="border px-3 py-2 rounded-md col-span-2"
            />
          </div>
        </div>

        {/* Contact Information */}
        <div>
          <h2 className="text-lg font-semibold">Contact Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              name="contact_person"
              value={formData.contact_person}
              onChange={handleChange}
              placeholder="Contact Person"
              className="border px-3 py-2 rounded-md"
            />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email"
              className="border px-3 py-2 rounded-md"
            />
            <input
              type="text"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              placeholder="Phone Number"
              className="border px-3 py-2 rounded-md col-span-2"
            />
          </div>
        </div>

        {/* Additional Contacts */}
        <div>
          <h2 className="text-lg font-semibold">Additional Contacts</h2>
          <button
            type="button"
            onClick={handleAddContact}
            className="bg-blue-600 text-white px-4 py-2 rounded-md mb-2"
          >
            Add Contact
          </button>
          {formData.additionalContacts.map((contact, index) => (
            <div key={index} className="grid grid-cols-3 gap-4 mb-2">
              <input
                type="text"
                name="contactPerson"
                value={contact.contactPerson}
                onChange={(e) => handleContactChange(index, e)}
                placeholder="Contact Person"
                className="border px-3 py-2 rounded-md"
              />
              <input
                type="email"
                name="email"
                value={contact.email}
                onChange={(e) => handleContactChange(index, e)}
                placeholder="Email"
                className="border px-3 py-2 rounded-md"
              />
              <input
                type="text"
                name="phoneNumber"
                value={contact.phoneNumber}
                onChange={(e) => handleContactChange(index, e)}
                placeholder="Phone Number"
                className="border px-3 py-2 rounded-md"
              />
            </div>
          ))}
        </div>

        {/* Address */}
        <div>
          <h2 className="text-lg font-semibold">Address</h2>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              name="street_address"
              value={formData.street_address}
              onChange={handleChange}
              placeholder="Street Address"
              className="border px-3 py-2 rounded-md col-span-2"
            />
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="City"
              className="border px-3 py-2 rounded-md"
            />
            <input
              type="text"
              name="region"
              value={formData.region}
              onChange={handleChange}
              placeholder="Region"
              className="border px-3 py-2 rounded-md"
            />
            <input
              type="text"
              name="zip_code"
              value={formData.zip_code}
              onChange={handleChange}
              placeholder="Zip Code"
              className="border px-3 py-2 rounded-md col-span-2"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="border border-red-600 text-red-600 px-4 py-2 rounded-md"
          >
            Clear Forms
          </button>
          <button
            type="submit"
            className="bg-red-600 text-white px-4 py-2 rounded-md"
          >
            Submit Registration
          </button>
        </div>
      </form>
    </div>
  );
};

export default SupplierRegistrationForm;

import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; 
import axios from "axios";


const SupplierRegistration = () => {
  const navigate = useNavigate();


    const [supplier, setSupplier] = useState({
        company_name: "",
        bir_no: "",
        contact_person: "",
        email: "",
        phone_number: "",
        street_address: "",
        city: "",
        region: "",
        zip_code: "",
        contacts: []
    });

    const [newContact, setNewContact] = useState({ contact_person: "", email: "", phone_number: "" });

    const handleChange = (e) => {
        setSupplier({ ...supplier, [e.target.name]: e.target.value });
    };

    const handleContactChange = (e) => {
        setNewContact({ ...newContact, [e.target.name]: e.target.value });
    };

    const addContact = () => {
        if (newContact.contact_person && newContact.email && newContact.phone_number) {
            setSupplier({ ...supplier, contacts: [...supplier.contacts, newContact] });
            setNewContact({ contact_person: "", email: "", phone_number: "" });
        }
    };

    const removeContact = (index) => {
        const updatedContacts = supplier.contacts.filter((_, i) => i !== index);
        setSupplier({ ...supplier, contacts: updatedContacts });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      console.log("Submitting Data:", JSON.stringify(supplier, null, 2));  // ✅ Log request
  
      try {
          const response = await axios.post("http://localhost:8080/api/suppliers/", supplier);
          console.log("Response:", response.data);  // ✅ Log API response
          alert("Supplier registered successfully!");
          navigate("/suppliers");
      } catch (error) {
          console.error("Error:", error.response?.data || error.message);
      }
  };
  

    return (
        <div className="container mx-auto p-6">
            <h2 className="text-2xl font-bold border-l-4 border-red-500 pl-2">Supplier Registration</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <h3 className="font-semibold">Company Information</h3>
                    <input type="text" name="company_name" placeholder="Company Name" value={supplier.company_name} onChange={handleChange} className="w-full border p-2" />
                    <input type="text" name="bir_no" placeholder="BIR NO." value={supplier.bir_no} onChange={handleChange} className="w-full border p-2 mt-2" />
                </div>

                <div>
                    <h3 className="font-semibold">Contact Information</h3>
                    <input type="text" name="contact_person" placeholder="Contact Person" value={supplier.contact_person} onChange={handleChange} className="w-full border p-2" />
                    <input type="email" name="email" placeholder="Email" value={supplier.email} onChange={handleChange} className="w-full border p-2 mt-2" />
                    <input type="text" name="phone_number" placeholder="Phone Number" value={supplier.phone_number} onChange={handleChange} className="w-full border p-2 mt-2" />
                </div>

                <div>
                    <h3 className="font-semibold">Additional Contacts</h3>
                    {supplier.contacts.map((contact, index) => (
                        <div key={index} className="border p-2 mb-2 flex justify-between items-center">
                            <span>{contact.contact_person} - {contact.email} - {contact.phone_number}</span>
                            <button type="button" onClick={() => removeContact(index)} className="bg-red-500 text-white px-2 py-1">Remove</button>
                        </div>
                    ))}
                    <input type="text" name="contact_person" placeholder="Contact Person" value={newContact.contact_person} onChange={handleContactChange} className="w-full border p-2" />
                    <input type="email" name="email" placeholder="Email" value={newContact.email} onChange={handleContactChange} className="w-full border p-2 mt-2" />
                    <input type="text" name="phone_number" placeholder="Phone Number" value={newContact.phone_number} onChange={handleContactChange} className="w-full border p-2 mt-2" />
                    <button type="button" onClick={addContact} className="bg-blue-500 text-white px-4 py-2 mt-2">Add Contact</button>
                </div>

                <div>
                    <h3 className="font-semibold">Address</h3>
                    <input type="text" name="street_address" placeholder="Street Address" value={supplier.street_address} onChange={handleChange} className="w-full border p-2" />
                    <input type="text" name="city" placeholder="City" value={supplier.city} onChange={handleChange} className="w-full border p-2 mt-2" />
                    <input type="text" name="region" placeholder="Region" value={supplier.region} onChange={handleChange} className="w-full border p-2 mt-2" />
                    <input type="text" name="zip_code" placeholder="Zip Code" value={supplier.zip_code} onChange={handleChange} className="w-full border p-2 mt-2" />
                </div>

                <div className="flex justify-between">
    <button 
        type="button" 
        className="border px-4 py-2" 
        onClick={() => navigate("/suppliers")} // ✅ Redirect to supplier list
    >
        Back
    </button>

                    <button type="submit" className="bg-red-500 text-white px-4 py-2">Submit Registration</button>
                </div>
            </form>
        </div>
    );
};

export default SupplierRegistration;

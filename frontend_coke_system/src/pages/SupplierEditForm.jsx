import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

const SupplierEditForm = () => {
    const { id } = useParams(); // Get supplier ID from URL
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
        contacts: [] // Store additional contacts
    });

    const [newContact, setNewContact] = useState({ contact_person: "", email: "", phone_number: "" });

    // Fetch supplier details
    useEffect(() => {
        axios.get(`http://localhost:8080/api/suppliers/${id}/`)
            .then(response => setSupplier(response.data))
            .catch(error => console.error("Error fetching supplier:", error));
    }, [id]);

    // Handle input change
    const handleChange = (e) => {
        setSupplier({ ...supplier, [e.target.name]: e.target.value });
    };

    // Handle contact input change
    const handleContactChange = (e) => {
        setNewContact({ ...newContact, [e.target.name]: e.target.value });
    };

    // Add new contact to the list
    const addContact = () => {
        if (newContact.contact_person && newContact.email && newContact.phone_number) {
            setSupplier({ ...supplier, contacts: [...supplier.contacts, newContact] });
            setNewContact({ contact_person: "", email: "", phone_number: "" }); // Reset input fields
        }
    };

    // Remove contact from the list
    const removeContact = (index) => {
        const updatedContacts = supplier.contacts.filter((_, i) => i !== index);
        setSupplier({ ...supplier, contacts: updatedContacts });
    };

    // Update supplier data
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`http://localhost:8080/api/suppliers/${id}/`, supplier);
            alert("Supplier updated successfully!");
            navigate("/suppliers"); // Redirect to supplier list
        } catch (error) {
            console.error("Error updating supplier:", error);
        }
    };

    return (
        <div className="container mx-auto p-6">
            <h2 className="text-2xl font-bold border-l-4 border-blue-500 pl-2">Edit Supplier</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" name="company_name" value={supplier.company_name} onChange={handleChange} placeholder="Company Name" className="w-full border p-2" />
                <input type="text" name="bir_no" value={supplier.bir_no} onChange={handleChange} placeholder="BIR NO." className="w-full border p-2" />
                <input type="text" name="contact_person" value={supplier.contact_person} onChange={handleChange} placeholder="Contact Person" className="w-full border p-2" />
                <input type="email" name="email" value={supplier.email} onChange={handleChange} placeholder="Email" className="w-full border p-2" />
                <input type="text" name="phone_number" value={supplier.phone_number} onChange={handleChange} placeholder="Phone Number" className="w-full border p-2" />
                <input type="text" name="street_address" value={supplier.street_address} onChange={handleChange} placeholder="Street Address" className="w-full border p-2" />
                <input type="text" name="city" value={supplier.city} onChange={handleChange} placeholder="City" className="w-full border p-2" />
                <input type="text" name="region" value={supplier.region} onChange={handleChange} placeholder="Region" className="w-full border p-2" />
                <input type="text" name="zip_code" value={supplier.zip_code} onChange={handleChange} placeholder="Zip Code" className="w-full border p-2" />

                {/* Additional Contacts Section */}
                <div>
                    <h3 className="font-semibold">Additional Contacts</h3>
                    {supplier.contacts.map((contact, index) => (
                        <div key={index} className="border p-2 mb-2 flex justify-between items-center">
                            <span>{contact.contact_person} - {contact.email} - {contact.phone_number}</span>
                            <button type="button" onClick={() => removeContact(index)} className="bg-red-500 text-white px-2 py-1">Remove</button>
                        </div>
                    ))}
                    <input type="text" name="contact_person" value={newContact.contact_person} onChange={handleContactChange} placeholder="Contact Person" className="w-full border p-2" />
                    <input type="email" name="email" value={newContact.email} onChange={handleContactChange} placeholder="Email" className="w-full border p-2 mt-2" />
                    <input type="text" name="phone_number" value={newContact.phone_number} onChange={handleContactChange} placeholder="Phone Number" className="w-full border p-2 mt-2" />
                    <button type="button" onClick={addContact} className="bg-blue-500 text-white px-4 py-2 mt-2">Add Contact</button>
                </div>

                <div className="flex justify-between">
                    <button type="button" onClick={() => navigate("/suppliers")} className="border px-4 py-2">Back</button>
                    <button type="submit" className="bg-blue-500 text-white px-4 py-2">Update Supplier</button>
                </div>
            </form>
        </div>
    );
};

export default SupplierEditForm;

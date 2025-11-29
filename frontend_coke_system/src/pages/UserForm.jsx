import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { successStyle } from "../utils/toastStyles";
import api from "../api"; // Import the custom API instance

const UserForm = ({ onUserAdded, onClose }) => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    gender: "",
    phone_number: "",
    email: "",
    role_id: "",
    warehouse_id: "",
    username: "",
    is_active: true,
    password: "",
  });

  const [roles, setRoles] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);

  // ---------------- Fetch Roles & Warehouses ----------------
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await api.get("/roles/");  // Use api.js for roles
        setRoles(response.data);
      } catch (error) {
        console.error("Error fetching roles:", error);
        toast.error("Failed to load roles. Please refresh the page.");
      }
    };

    const fetchWarehouses = async () => {
      try {
        const response = await api.get("/warehouses/");  // Use api.js for warehouses
        setWarehouses(response.data);
      } catch (error) {
        console.error("Error fetching warehouses:", error);
        toast.error("Failed to load warehouses. Please refresh the page.");
      }
    };

    fetchRoles();
    fetchWarehouses();
  }, []);

  // ---------------- Email Validation (unchanged) ----------------
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    if (email !== email.toLowerCase())
      return "Email address must use lowercase letters only.";

    const [localPart, domain] = email.split("@");
    if (domain === "gmail.com" && (localPart.length < 6 || localPart.length > 30))
      return "Invalid Gmail length (must be 6–30 characters before @gmail.com)";

    const invalidPatterns = [
      /^test/,
      /^fake/,
      /^temp/,
      /^dummy/,
      /^sample/,
      /^\d+$/,
      /^[a-z]{1,3}\d+$/,
      /^.*(test|fake|temp|dummy|sample|demo).*/,
      /^(admin|root|postmaster|webmaster|mail|email|noreply|support)$/,
    ];
    if (invalidPatterns.some((p) => p.test(localPart)))
      return "This Gmail address appears fake or inactive.";

    const suspiciousDomains = [
      "tempmail.com",
      "10minutemail.com",
      "guerrillamail.com",
      "mailinator.com",
      "throwaway.email",
      "temp-mail.org",
      "yopmail.com",
      "maildrop.cc",
      "sharklasers.com",
    ];
    if (suspiciousDomains.includes(domain))
      return "Temporary or disposable email addresses are not allowed";

    return null;
  };

  // ---------------- Gmail Existence Simulation ----------------
  const verifyGmailExists = async (email) => {
    if (!email.endsWith("@gmail.com")) return true;
    setIsVerifyingEmail(true);
    try {
      const localPart = email.split("@")[0];
      const hasProperStructure =
        localPart.length >= 6 &&
        localPart.length <= 30 &&
        /^[a-z][a-z0-9._]*[a-z0-9]$/.test(localPart);
      if (!hasProperStructure)
        throw new Error("This Gmail doesn't appear to be active. Use your real Gmail.");

      await new Promise((r) => setTimeout(r, 1000)); // simulate
      return true;
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  // ---------------- ✅ Phone Number Validation ----------------
  const validatePhoneNumber = (phone) => {
    if (!phone) return "Phone number is required.";
    if (!/^\d+$/.test(phone)) return "Phone number must contain only numbers.";
    if (phone.length !== 11)
      return "Phone number must be exactly 11 digits long.";
    return null;
  };

  // ---------------- Form Handlers ----------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error on change
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));

    // Real-time validations
    if (name === "email" && value) {
      const emailError = validateEmail(value);
      if (emailError) setErrors((prev) => ({ ...prev, email: emailError }));
    }

    if (name === "phone_number" && value) {
      const phoneError = validatePhoneNumber(value);
      if (phoneError) setErrors((prev) => ({ ...prev, phone_number: phoneError }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      // --- Client-side validation ---
      const phoneError = validatePhoneNumber(formData.phone_number);
      if (phoneError) {
        setErrors({ phone_number: phoneError });
        toast.error(phoneError);
        return;
      }

      if (formData.email) {
        const emailError = validateEmail(formData.email);
        if (emailError) {
          setErrors({ email: emailError });
          toast.error("Please fix the email format before submitting");
          return;
        }

        if (formData.email.endsWith("@gmail.com")) {
          try {
            await verifyGmailExists(formData.email);
          } catch (err) {
            setErrors({ email: err.message });
            toast.error("Gmail verification failed: " + err.message);
            return;
          }
        }
      }

      const userPayload = {
        ...formData,
        role_id: Number(formData.role_id) || null,
        warehouse_id: Number(formData.warehouse_id) || null,
        is_active: Boolean(formData.is_active),
      };

      const response = await api.post("/users/", userPayload);  // Use api.js for POST request

      const data = response.data;

      if (response.status === 201) {
        toast.success(`User '${data.username}' has been created successfully!`, { style: successStyle });
        onUserAdded(data);
        onClose();
      } else {
        // Log error details from the response
        if (data.errors) {
          data.errors.forEach((err) => toast.error(`${err.field}: ${err.message}`));
        } else {
          toast.error("Failed to create user. Please check the form.");
        }
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------- JSX Form ----------------
  return (
    <div className="modal-overlay bg-gray-900 bg-opacity-50">
      <div className="w-full max-w-3xl p-8 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">New User</h2>
        <form onSubmit={handleSubmit}>
          {/* Name Fields */}
          <div className="mb-5 flex gap-6">
            <div className="w-1/2">
              <label className="block font-medium">First Name</label>
              <input
                type="text"
                name="first_name"
                className="w-full border p-2 rounded"
                required
                onChange={handleChange}
                value={formData.first_name}
              />
            </div>
            <div className="w-1/2">
              <label className="block font-medium">Last Name</label>
              <input
                type="text"
                name="last_name"
                className="w-full border p-2 rounded"
                required
                onChange={handleChange}
                value={formData.last_name}
              />
            </div>
          </div>

          {/* Gender & Phone */}
          <div className="mb-5 flex gap-6">
            <div className="w-1/2">
              <label className="block font-medium">Gender</label>
              <select
                name="gender"
                className="w-full border p-2 rounded"
                required
                onChange={handleChange}
                value={formData.gender}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="w-1/2">
              <label className="block font-medium">Phone Number</label>
              <input
                type="text"
                name="phone_number"
                className={`w-full border p-2 rounded ${errors.phone_number ? "border-red-500" : ""}`}
                required
                onChange={handleChange}
                value={formData.phone_number}
                placeholder="e.g., 09123456789"
              />
              {errors.phone_number && <p className="text-red-500 text-sm mt-1">{errors.phone_number}</p>}
            </div>
          </div>

          {/* Email */}
          <div className="mb-5">
            <label className="block font-medium">
              Email {isVerifyingEmail && <span className="text-blue-500">(Verifying...)</span>}
            </label>
            <input
              type="email"
              name="email"
              className={`w-full border p-2 rounded ${errors.email ? "border-red-500" : ""}`}
              required
              onChange={handleChange}
              value={formData.email}
              placeholder="example@gmail.com (lowercase only)"
              disabled={isVerifyingEmail}
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          {/* Role & Warehouse */}
          <div className="mb-5 flex gap-6">
            <div className="w-1/2">
              <label className="block font-medium">Role</label>
              <select
                name="role_id"
                className="w-full border p-2 rounded"
                required
                onChange={handleChange}
                value={formData.role_id}
              >
                <option value="">Select Role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-1/2">
              <label className="block font-medium">Warehouse</label>
              <select
                name="warehouse_id"
                className="w-full border p-2 rounded"
                required
                onChange={handleChange}
                value={formData.warehouse_id}
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Username & Password */}
          <div className="mb-5 flex gap-6">
            <div className="w-1/2">
              <label className="block font-medium">Username</label>
              <input
                type="text"
                name="username"
                className="w-full border p-2 rounded"
                required
                onChange={handleChange}
                value={formData.username}
              />
            </div>
            <div className="w-1/2">
              <label className="block font-medium">Password</label>
              <input
                type="password"
                name="password"
                className="w-full border p-2 rounded"
                required
                onChange={handleChange}
                value={formData.password}
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-between">
            <button
              type="button"
              className="btn btn-cancel py-2 px-4"
              onClick={onClose}
              disabled={isSubmitting || isVerifyingEmail}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary py-2 px-4"
              disabled={isSubmitting || isVerifyingEmail}
            >
              {isSubmitting
                ? "Creating..."
                : isVerifyingEmail
                ? "Verifying Email..."
                : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;

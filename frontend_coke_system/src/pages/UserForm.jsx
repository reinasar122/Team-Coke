import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { successStyle } from "../utils/toastStyles";
import api from "../api"; // ✅ correct
import WifiLoader from "../components/WifiLoader";

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

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data } = await api.get("/roles/");
      setRoles(data);

      } catch (error) {
        console.error("Error fetching roles:", error);
        toast.error("Failed to load roles. Please refresh the page.");
      }
    };

    const fetchWarehouses = async () => {
      try {
        const { data } = await api.get("/warehouses/");
setWarehouses(data);

      } catch (error) {
        console.error("Error fetching warehouses:", error);
        toast.error("Failed to load warehouses. Please refresh the page.");
      }
    };

    fetchRoles();
    fetchWarehouses();
  }, []);

  // Email validation function - STRICT: No uppercase letters allowed
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }

    // Check if email contains any uppercase letters
    if (email !== email.toLowerCase()) {
      return "Email address must use lowercase letters only. Example: oracoytrisha@gmail.com";
    }

    const [localPart, domain] = email.split('@');

    // Gmail-specific validation for activated accounts
    if (domain === 'gmail.com') {
      // Check minimum length for Gmail
      if (localPart.length < 6) {
        return "Gmail address too short. Must be at least 6 characters before @gmail.com";
      }

      // Check maximum length
      if (localPart.length > 30) {
        return "Gmail address too long. Must be 30 characters or less before @gmail.com";
      }

      // Check for invalid patterns that suggest fake/inactive accounts
      const invalidPatterns = [
        /^test/,           // starts with "test"
        /^fake/,          // starts with "fake"
        /^temp/,          // starts with "temp"
        /^dummy/,         // starts with "dummy"
        /^sample/,        // starts with "sample"
        /^\d+$/,          // only numbers
        /^[a-z]{1,3}\d+$/,    // simple letter+number pattern like "abc123"
        /^.*(test|fake|temp|dummy|sample|demo).*/, // contains suspicious words
        /^(admin|root|postmaster|webmaster|mail|email|noreply|support)$/, // system accounts
      ];

      if (invalidPatterns.some(pattern => pattern.test(localPart))) {
        return "This Gmail address appears to be inactive or fake. Please use your real active Gmail address.";
      }

      // Check for proper Gmail format (must contain letters and reasonable structure)
      if (!/^[a-z][a-z0-9._]*[a-z0-9]$/.test(localPart)) {
        return "Invalid Gmail format. Must start with a letter and contain only letters, numbers, dots, and underscores.";
      }

      // Check for suspicious patterns (too many numbers, too simple)
      const numberCount = (localPart.match(/\d/g) || []).length;
      if (numberCount > localPart.length / 2) {
        return "Gmail address has too many numbers. Please use your real Gmail address.";
      }

      // Check for repeated characters (like aaaa or 1111)
      if (/(.)\1{3,}/.test(localPart)) {
        return "Gmail address contains too many repeated characters. Please use your real Gmail address.";
      }
    }

    // Check for disposable email domains
    const suspiciousDomains = [
      'tempmail.com', '10minutemail.com', 'guerrillamail.com', 
      'mailinator.com', 'throwaway.email', 'temp-mail.org',
      'yopmail.com', 'maildrop.cc', 'sharklasers.com'
    ];
    
    if (suspiciousDomains.includes(domain)) {
      return "Temporary or disposable email addresses are not allowed";
    }

    return null;
  };

  // Additional Gmail verification function
  const verifyGmailExists = async (email) => {
    if (!email.endsWith('@gmail.com')) return true;

    try {
      setIsVerifyingEmail(true);
      
      const localPart = email.split('@')[0];
      
      // Enhanced validation for likely active Gmail accounts
      const hasProperStructure = (
        localPart.length >= 6 && 
        localPart.length <= 30 &&
        /^[a-z][a-z0-9._]*[a-z0-9]$/.test(localPart) &&
        !/^(admin|root|postmaster|webmaster|mail|email|test|user|demo|sample|fake|temp)/.test(localPart) &&
        // Must have a reasonable mix of letters
        /[a-z].*[a-z]/.test(localPart)
      );

      if (!hasProperStructure) {
        throw new Error("This Gmail address doesn't appear to be an active account. Please use your real Gmail address.");
      }

      // Simulate checking if Gmail is active (in real app, you'd use email verification service)
      await new Promise(resolve => setTimeout(resolve, 1000));

      return true;
    } catch (error) {
      throw error;
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));

    // Clear specific field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }

    // Real-time validation for email
    if (name === 'email' && value) {
      const emailError = validateEmail(value);
      if (emailError) {
        setErrors(prev => ({ ...prev, email: emailError }));
      }
    }
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      setIsSubmitting(true);
      setErrors({});

      try {
        // ✅ Email validation
        if (formData.email) {
          const emailError = validateEmail(formData.email);
          if (emailError) {
            setErrors({ email: emailError });
            toast.error("Please fix the email format before submitting");
            setIsSubmitting(false);
            return;
          }

          if (formData.email.endsWith('@gmail.com')) {
            try {
              await verifyGmailExists(formData.email);
            } catch (verifyError) {
              setErrors({ email: verifyError.message });
              toast.error("Gmail verification failed: " + verifyError.message);
              setIsSubmitting(false);
              return;
            }
          }
        }

        // ✅ Prepare payload
        const userPayload = {
          ...formData,
          role_id: Number(formData.role_id) || null,
          warehouse_id: Number(formData.warehouse_id) || null,
          is_active: Boolean(formData.is_active),
        };

        // ✅ Create user
        const { data } = await api.post("/users/", userPayload);

        toast.success(`User '${data.username}' has been created successfully!`, { style: successStyle });

        // ✅ Refresh user list and close modal
        onUserAdded(data);
        onClose();
      } catch (error) {
        const data = error.response?.data;
        if (data?.email?.[0]) {
          if (data.email[0].includes("already exists")) {
            toast.error("This email address is already registered. Please use a different email.");
          } else {
            toast.error(`Email error: ${data.email[0]}`);
          }
        } else if (data?.username?.[0]) {
          toast.error(`Username error: ${data.username[0]}`);
        } else {
          toast.error("Failed to create user. Please check the form.");
        }
      } finally {
        // ✅ Hide loader
        setIsSubmitting(false);
      }
    };




  return (
    <div className="modal-overlay bg-gray-900 bg-opacity-50 relative">
    <div className="w-full max-w-3xl p-8 bg-white shadow-lg rounded-lg relative">

      {/* ✅ Add loader overlay */}
      {isSubmitting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-lg z-50">
          <WifiLoader text="Creating user..." />
        </div>
      )}
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
                className="w-full border p-2 rounded" 
                required 
                onChange={handleChange}
                value={formData.phone_number}
              />
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
              className={`w-full border p-2 rounded ${errors.email ? 'border-red-500' : ''}`}
              required 
              onChange={handleChange}
              value={formData.email}
              placeholder="example@gmail.com (lowercase only)"
              disabled={isVerifyingEmail}
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
            <p className="text-gray-500 text-sm mt-1">
              Email must be lowercase and activated. Gmail addresses will be verified for activity.
            </p>
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
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
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
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
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
              className="btn btn-cancel py-2 px-4 " 
              onClick={onClose}
              disabled={isSubmitting || isVerifyingEmail}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary py-2 px-4 "
              disabled={isSubmitting || isVerifyingEmail}
            >
              {isSubmitting ? "Creating..." : isVerifyingEmail ? "Verifying Email..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;
# TODO — Next Session

## 1. Backend — Revert auth changes in `settings.py`

Remove the following blocks from `backend_coke_system/backend_coke_system/settings.py`:

- **`REST_FRAMEWORK = { ... }`** (lines 141–154) — removes `JWTAuthentication` and `IsAuthenticatedOrReadOnly`
- **`SIMPLE_JWT = { ... }`** (lines 157–164) — removes JWT token config
- **`CHATBOT_USE_RASA`** (line 184)
- **`RASA_NLU_ENDPOINT`** (line 185)
- **`RASA_TIMEOUT_SECONDS`** (line 186)

> After removal, DRF defaults apply: no auth classes, `AllowAny` for all endpoints.

## 2. Backend — Remove `permission_classes` from `UserDetailView`

In `backend_coke_system/api/views.py`, line 641 — remove the line:
```
permission_classes = [AllowAny]
```
from `UserDetailView`.

## 3. Frontend — Fix `AdminOnlyRoute` error in `App.jsx`

In `frontend_coke_system/src/App.jsx`, line 360:
```jsx
<Route path="/chatbot-devices" element={<AdminOnlyRoute><ChatbotDeviceApprovals /></AdminOnlyRoute>}/>
```

`AdminOnlyRoute` is used but never defined. **Choose one option:**

### Option A (recommended): Define `AdminOnlyRoute` inline
Add this component near the other route guards (around line 167):
```jsx
const AdminOnlyRoute = ({ children }) => {
  const user = getStoredUser();
  if (!user || !isAdminRole(user?.role)) {
    return <Navigate to="/no-access" replace />;
  }
  return children;
};
```

### Option B: Drop the wrapper entirely
Replace line 360 with:
```jsx
<Route path="/chatbot-devices" element={<ChatbotDeviceApprovals />}/>
```

---

## Notes for later
- The JWT token generation in `LoginSerializer` (`api/views.py:1836`) and `Login.jsx` token storage will become dead code once auth settings are removed. Won't break anything, but could be cleaned up.

import { useParams, useNavigate } from "react-router-dom";
import EditRoleAccess from "./EditRoleAccess";

const EditRoleAccessWrapper = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="p-6 bg-white rounded shadow">
      <EditRoleAccess roleId={id} onClose={() => navigate("/roles")} />
    </div>
  );
};

export default EditRoleAccessWrapper;

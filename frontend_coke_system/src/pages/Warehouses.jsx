import React from "react";
import { FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";


const Warehouses = () => {
  const navigate = useNavigate(); // Define navigate inside the component

  return (
    <div className="grid ">
      {/* Header */}

      {/* Warehouse Content */}
      <div className="p-6 flex-wrap w-100">
        <div className="grid">
        <button
        className="bg-green-500 text-white py-2 rounded col-end-12 mb-4"
        onClick={() => navigate("/warehouseForm")}>
        + New Warehouse
      </button>
        </div>

        {/* Warehouse Cards */}
        <div className="grid grid-cols-2 gap-6">
          {/* Sample Warehouse Card 1 */}
          <div className="bg-white shadow-lg p-4 rounded">
            <h2 className="font-bold text-lg">Samboan</h2>
            <p className="font-bold">Punong Samboan</p>
            <p>Cebu, Philippines, 5010</p>
            <p>09678963167</p>
            <p>samboanwilfs@gmail.com</p>
            <div className="flex flex-nowrap justify-end items-stretch" >
              <button className="bg-blue-500 text-white px-3 py-1 rounded mt-2 col-end-12" onClick={() => navigate("/editWarehouse")}>
                Edit
              </button>
              <button className="bg-red-500 text-white px-2 py-2 rounded col-end-12 mt-2 ml-2 flex items-center gap-2">
                <FaTrash /> 
              </button>
            </div>
          </div> {/* ✅ Closed the first warehouse card div properly */}

          {/* Sample Warehouse Card 2 */}
          <div className="bg-white shadow-lg p-4 rounded">
            <h2 className="font-bold text-lg">Labangon</h2>
            <p className="font-bold">Labangon Street</p>
            <p>Cebu City, Philippines, 5029</p>
            <p>09679223167</p>
            <p>labangonwilfs@gmail.com</p>
            <div className="flex flex-nowrap justify-end items-stretch">
              <button className="bg-blue-500 text-white px-3 py-1 rounded mt-2 col-end-12" onClick={() => navigate("/editWarehouse")}>
                Edit
              </button>
              <button className="bg-red-500 text-white px-2 py-2 rounded col-end-12 mt-2 ml-2 flex items-center gap-2">
                <FaTrash />
              </button>
            </div>
          </div> {/* ✅ Closed the second warehouse card div properly */} 
        </div>
      </div>
    </div>
  );
};

export default Warehouses;

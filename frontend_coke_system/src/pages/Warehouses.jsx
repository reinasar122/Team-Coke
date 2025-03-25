import React from "react";

const Warehouses = () => {
  return (
  
      <div className="grid justify-items-start bg-gray-100">
        {/* Header */}

        {/* Warehouse Content */}
        <div className="p-6 flex-wrap: wrap; w-100"> {/* Added mt-16 to ensure content doesn't overlap header */}
          <button className="bg-green-500 text-white px-4 py-2 rounded mb-4">
            + New Warehouse
          </button>

          {/* Warehouse Cards */}
          <div className="grid grid-cols-2 gap-6">
            {/* Sample Warehouse Cards */}
            <div className="bg-white shadow-md p-4 rounded">
              <h2 className="font-bold text-lg">Samboan</h2>
              <p className="font-bold">Punong Samboan</p>
              <p>Cebu, Philippines, 5010</p>
              <p>09678963167</p>
              <p>samboanwilfs@gmail.com</p>
              <button className="bg-blue-500 text-white px-3 py-1 rounded mt-2">
                Edit
              </button>
            </div>

            <div className="bg-white shadow-md p-4 rounded">
              <h2 className="font-bold text-lg">Labangon</h2>
              <p className="font-bold">Labangon Street</p>
              <p>Cebu City, Philippines, 5029</p>
              <p>09679223167</p>
              <p>labangonwilfs@gmail.com</p>
              <button className="bg-blue-500 text-white px-3 py-1 rounded mt-2">
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>
  );
};

export default Warehouses;

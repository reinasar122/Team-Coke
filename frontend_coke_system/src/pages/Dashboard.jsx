import "../styles/dashboard.scss"; // Ensure this path is correct

const Dashboard = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      
      {/* Statistics Chart - Full Width */}
      <div className="col-span-3 bg-white rounded-xl shadow-md p-4">
        <h2 className="text-lg font-semibold mb-2">Statistics</h2>
        <div className="w-full h-[250px] flex items-center justify-center text-gray-400">
          No data available
        </div>
      </div>

      {/* Stocks & Trading - Use GRID instead of FLEX */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stocks Section */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <h2 className="text-lg font-semibold mb-2">Stocks</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Quantity</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="4" className="text-center text-gray-400 p-4">
                  No stocks available
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Trading Widget */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <h2 className="text-lg font-semibold mb-2">Trading</h2>
          <div className="w-full h-[200px] flex items-center justify-center text-gray-400">
            No Trading available
          </div>
        </div>
      </div>

      {/* Sales Reports */}
      <div className="col-span-2 bg-white rounded-xl shadow-md p-4">
        <h2 className="text-lg font-semibold mb-2">Reports</h2>
        <div className="w-full h-[200px] flex items-center justify-center text-gray-400">
          No reports available
        </div>
      </div>

      {/* Placeholder for Additional Widgets */}
      <div className="bg-gray-200 rounded-xl shadow-md p-4 flex items-center justify-center">
        <span className="text-gray-500 text-sm">Add Widget</span>
      </div>
    </div>
  );
};

export default Dashboard;

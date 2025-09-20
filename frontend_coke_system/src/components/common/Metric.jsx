const Metric = ({ label, value }) => {
  return (
    <div className="p-3 border rounded bg-white">
      <p className="text-xs text-gray-500">{label}</p>
      <h3 className="text-lg font-bold">{value}</h3>
    </div>
  );
};

export default Metric;
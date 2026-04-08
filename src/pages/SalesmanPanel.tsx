import { useState } from "react";

const SalesmanPanel = () => {
  const [active, setActive] = useState(true);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Salesman Panel</h2>

      <p>Status: {active ? "Active" : "Inactive"}</p>

      <button onClick={() => setActive(!active)}>
        {active ? "Deactivate" : "Activate"}
      </button>

      <br /><br />

      <button>Assign QR (Next step)</button>
    </div>
  );
};

export default SalesmanPanel;

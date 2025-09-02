import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";

const formatPhp = (n) =>
  Number.isFinite(Number(n))
    ? `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "₱0.00";

const safe = (v, d = 0) => (v === null || v === undefined || v === "" ? d : v);

const formatToManila = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
};

const StatusPill = ({ status }) => {
  const st = (status || "").toLowerCase();
  const base = "px-2 py-1 rounded text-xs font-semibold";
  if (st === "pending") return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>;
  if (st === "complete" || st === "completed")
    return <span className={`${base} bg-green-100 text-green-800`}>Completed</span>;
  return <span className={`${base} bg-gray-100 text-gray-800`}>{status || "—"}</span>;
};

const pickName = (item) => {
  const p = item.product_detail || item.product || {};
  return (
    item.product_name ||
    p.product_name ||
    p.name ||
    p.title ||
    `#${p.id ?? item.product_id ?? "—"}`
  );
};

const pickContentNo = (item) => {
  const p = item.product_detail || item.product || {};
  return (
    Number(p?.unit_type?.content_no) ||
    Number(p?.unit_type_content_no) ||
    Number(p?.content_no) ||
    1
  );
};

const pickSellingPrice = (item) =>
  Number(safe(item.selling_price)) ||
  Number(safe(item.unit_price)) ||
  Number(safe(item.price));

const pickRouteLabel = (obj) => {
  if (!obj) return "";
  const val =
    obj.route_name ??
    obj.name ??
    obj.title ??
    obj.routeName ??
    (typeof obj === "string" ? obj : "");
  return typeof val === "string" ? val.trim() : "";
};

const VanLoadProductDetails = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const passedSale = location.state?.sale;
  const [sale, setSale] = useState(passedSale || null);
  const [loading, setLoading] = useState(!passedSale);

  // Human-friendly route name (kept separate from `sale`)
  const [resolvedRouteName, setResolvedRouteName] = useState("");

  // Fetch sale if not passed via navigation state
  useEffect(() => {
    if (passedSale) return;
    let alive = true;
    setLoading(true);
    axios
      .get(`http://localhost:8080/api/merchandisings/${id}/`)
      .then((res) => alive && setSale(res.data || null))
      .catch((err) => console.error("Failed to load sale:", err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, passedSale]);

  // Resolve Route name with robust fallbacks
  useEffect(() => {
    // 1) Already present in payload?
    const flat = pickRouteLabel(sale);
    if (flat) {
      setResolvedRouteName(flat);
      return;
    }
    const nested = pickRouteLabel(sale?.route);
    if (nested) {
      setResolvedRouteName(nested);
      return;
    }

    // 2) Only an id? accept number OR string "1"
    const maybeId = sale?.route && typeof sale.route === "object" ? sale.route.id : sale?.route;
    const routeId = Number.isFinite(Number(maybeId)) ? Number(maybeId) : null;

    if (!routeId) {
      setResolvedRouteName("—");
      return;
    }

    const token = localStorage.getItem("token");
    const cfg = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    let alive = true;

    const tryDetail = () =>
      axios
        .get(`http://localhost:8080/api/routes/${routeId}/`, cfg)
        .then((res) => {
          if (!alive) return;
          const name = pickRouteLabel(res.data);
          if (name) {
            setResolvedRouteName(name);
            return true;
          }
          return false;
        })
        .catch((err) => {
          if (!alive) return false;
          console.warn("Route detail lookup failed:", {
            routeId,
            status: err?.response?.status,
            data: err?.response?.data,
          });
          return false;
        });

    const tryListFallback = () => {
      const wid = sale?.warehouse; // merchandising usually has warehouse id
      if (!wid) return Promise.resolve(false);
      return axios
        .get(`http://localhost:8080/api/routes/?warehouse=${wid}`, cfg)
        .then((res) => {
          if (!alive) return false;
          const found = (Array.isArray(res.data) ? res.data : []).find(
            (r) => String(r.id) === String(routeId)
          );
          const name = pickRouteLabel(found);
          if (name) {
            setResolvedRouteName(name);
            return true;
          }
          return false;
        })
        .catch((err) => {
          if (!alive) return false;
          console.warn("Route list fallback failed:", {
            warehouse: wid,
            status: err?.response?.status,
            data: err?.response?.data,
          });
          return false;
        });
    };

    (async () => {
      const okDetail = await tryDetail();
      if (okDetail) return;
      const okList = await tryListFallback();
      if (okList) return;
      // Last resort
      setResolvedRouteName(`#${routeId}`);
    })();

    return () => {
      alive = false;
    };
  }, [sale]);

  const routeLabel = resolvedRouteName || "—";

  // Items
  const items = useMemo(() => (Array.isArray(sale?.items) ? sale.items : []), [sale]);

  // PRODUCTS SOLD
  const soldRows = useMemo(() => {
    return items.map((it) => {
      const name = pickName(it);
      const contentNo = pickContentNo(it);
      const soldShell = Number(safe(it.sold_shell));
      const soldPcs = Number(safe(it.sold_pcs));
      const sellingPrice = pickSellingPrice(it);

      const totalPcs = soldPcs + soldShell * contentNo;
      const lineTotal = sellingPrice * totalPcs;

      return {
        name,
        contentNo,
        soldShell,
        soldPcs,
        totalPcs,
        sellingPrice,
        lineTotal,
      };
    });
  }, [items]);

  const soldTotals = useMemo(
    () =>
      soldRows.reduce(
        (acc, r) => {
          acc.shell += r.soldShell;
          acc.pcs += r.soldPcs;
          acc.totalPcs += r.totalPcs;
          acc.amount += r.lineTotal;
          return acc;
        },
        { shell: 0, pcs: 0, totalPcs: 0, amount: 0 }
      ),
    [soldRows]
  );

  // EMPTIES RETURNED
const emptiesRows = useMemo(() => {
  return items.map((it) => {
    const name = pickName(it);
    const contentNo = pickContentNo(it);

    // 🔧 CHANGED: use the actual serializer fields
    const emptyShell = Number(safe(it.empty_return_shell));
    const emptyPcs   = Number(safe(it.empty_return_pcs));

    // 🔧 CHANGED: "Returned with Contents" are the ACTUAL returns
    const withContentShell = Number(safe(it.actual_return_shell));
    const withContentPcs   = Number(safe(it.actual_return_pcs));

    return {
      name,
      contentNo,
      emptyShell,
      emptyPcs,
      withContentShell,
      withContentPcs,
    };
  });
}, [items]);

// (optional) you can keep your totals reducer as-is; it now sums the right props:
const emptiesTotals = useMemo(
  () =>
    emptiesRows.reduce(
      (acc, r) => {
        acc.emptyShell += r.emptyShell;
        acc.emptyPcs += r.emptyPcs;
        acc.withContentShell += r.withContentShell;
        acc.withContentPcs += r.withContentPcs;
        return acc;
      },
      { emptyShell: 0, emptyPcs: 0, withContentShell: 0, withContentPcs: 0 }
    ),
  [emptiesRows]
);

  // Header fields
  const handledBy =
    sale?.handled_by_name || sale?.handled_by_username || sale?.handled_by || "—";
  const statusText = sale?.status || "";

  return (
    <div className="page">
      {loading && <div className="p-6">Loading…</div>}
      {!loading && !sale && <div className="p-6 text-red-600">Sale not found.</div>}

      {!loading && sale && (
        <>
         {/* HEADER */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          {/* Left: MSP Info */}
          <div>
            <div className="text-sm text">MSP No.</div>
            <div className="text-sm font-bold text">{sale.msp_no}</div>
            <div className="text-sm text mt-1">
              Van Load • {formatToManila(sale.date_time)}
            </div>
          </div>

          {/* Right: Handler Info */}
          <div className="text-right">
            <div className="text-xs text">Handled By</div>
            <div className="text-base font-semibold text">{handledBy}</div>
            <div className="text-sm text-gray-600 mt-1">Route: {routeLabel}</div>
            <div className="mt-3 flex justify-end">
              <StatusPill status={statusText} />
            </div>
          </div>
        </div>
      </div>




          {/* PRODUCTS SOLD */}
            <div className="table-wrapper m-5">
               <div className="p-3 m-4 border-b font-semibold">Products Sold</div>
              <table className="table">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-center">Sold (Shell)</th>
                    <th className="p-2 text-center">Sold (PCS)</th>
                    <th className="p-2 text-center">Unit Price</th>
                    <th className="p-2 text-center">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {soldRows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-left">{r.name}</td>
                      <td className="p-2 text-center">{r.soldShell}</td>
                      <td className="p-2 text-center">{r.soldPcs}</td>
                      <td className="p-2 text-center">{formatPhp(r.sellingPrice)}</td>
                      <td className="p-2 text-center font-semibold">{formatPhp(r.lineTotal)}</td>
                    </tr>
                  ))}

                  {/* TOTAL row */}
                 <tr className="border-t bg-gray-50 font-semibold">
                    {/* label aligned at the start */}
                    <td colSpan={4} className="p-2 text-left">
                      TOTAL
                    </td>

                    {/* number aligned at the end */}
                    <td className="p-2 text-right">
                      {formatPhp(soldTotals.amount)}
                    </td>
                  </tr>

                  
                </tbody>
              </table>
            </div>

          {/* EMPTIES RETURNED */}     
            <div className="table-wrapper m-4">
              <div className="p-3 border-b font-semibold m-4">Empties Returned</div>
              <table className="table">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-center">Empty (Shell)</th>
                    <th className="p-2 text-center">Empty (PCS)</th>
                    <th className="p-2 text-center">With Contents (Shell)</th>
                    <th className="p-2 text-center">With Contents (PCS)</th>
                  </tr>
                </thead>
                <tbody>
                  {emptiesRows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-left">{r.name}</td>
                      <td className="p-2 text-center">{r.emptyShell}</td>
                      <td className="p-2 text-center">{r.emptyPcs}</td>
                      <td className="p-2 text-center">{r.withContentShell}</td>
                      <td className="p-2 text-center">{r.withContentPcs}</td>
                    </tr>
                  ))}

                  {/* Totals row for empties (optional, currently commented out) */}
                  {/*
                  <tr className="border-t bg-gray-50 font-semibold">
                    <td className="p-2 text-right">TOTAL</td>
                    <td className="p-2 text-center">{emptiesTotals.emptyShell}</td>
                    <td className="p-2 text-center">{emptiesTotals.emptyPcs}</td>
                    <td className="p-2 text-center">{emptiesTotals.withContentShell}</td>
                    <td className="p-2 text-center">{emptiesTotals.withContentPcs}</td>
                  </tr>
                  */}
                </tbody>
              </table>
            </div>
          

          {/* ACTIONS */}
          <div className="flex justify-end gap-4">
            <button
              className="btn btn-back"
              onClick={() => navigate("/trading")}
            >
              Back
            </button>
          <button
            className="btn btn-print no-print"
            onClick={() => window.print()}
          >
            Print
          </button>

          </div>
        </>
      )}
    </div>
  );
};

export default VanLoadProductDetails;
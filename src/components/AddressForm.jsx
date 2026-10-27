import "../siteChrome.css";

export const EMPTY_ADDRESS = {
  label: "Home",
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

// Mirrors cleanAddress() in api/_lib/auth.js. Returns an error message or "".
export function validateAddress(a) {
  if (!a.name.trim()) return "Please enter the recipient's full name.";
  if (!/^\d{10}$/.test(a.phone.trim())) return "Please enter a valid 10-digit phone number.";
  if (!a.line1.trim()) return "Please enter the house number and street.";
  if (!a.city.trim()) return "Please enter the city.";
  if (!a.state.trim()) return "Please enter the state.";
  if (!/^\d{6}$/.test(a.pincode.trim())) return "Please enter a valid 6-digit pincode.";
  return "";
}

const LABELS = ["Home", "Work", "Other"];

// Controlled address fields. `idPrefix` keeps label/input ids unique when
// two forms are on one page.
export default function AddressForm({ value, onChange, idPrefix = "addr", showLabel = true }) {
  const set = (field) => (e) => {
    let v = e.target.value;
    if (field === "phone") v = v.replace(/\D/g, "").slice(0, 10);
    if (field === "pincode") v = v.replace(/\D/g, "").slice(0, 6);
    onChange({ ...value, [field]: v });
  };
  const id = (f) => `${idPrefix}-${f}`;

  return (
    <div className="addr-form">
      <div className="field-pair">
        <div className="field">
          <label htmlFor={id("name")}>Full name</label>
          <input id={id("name")} value={value.name} onChange={set("name")} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor={id("phone")}>Mobile number</label>
          <input
            id={id("phone")}
            value={value.phone}
            onChange={set("phone")}
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit mobile"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={id("line1")}>Flat / house no., building, street</label>
        <input id={id("line1")} value={value.line1} onChange={set("line1")} autoComplete="address-line1" />
      </div>
      <div className="field">
        <label htmlFor={id("line2")}>
          Area, landmark <span className="field-optional">(optional)</span>
        </label>
        <input id={id("line2")} value={value.line2} onChange={set("line2")} autoComplete="address-line2" />
      </div>
      <div className="field-trio">
        <div className="field">
          <label htmlFor={id("pincode")}>Pincode</label>
          <input id={id("pincode")} value={value.pincode} onChange={set("pincode")} inputMode="numeric" autoComplete="postal-code" />
        </div>
        <div className="field">
          <label htmlFor={id("city")}>City</label>
          <input id={id("city")} value={value.city} onChange={set("city")} autoComplete="address-level2" />
        </div>
        <div className="field">
          <label htmlFor={id("state")}>State</label>
          <input id={id("state")} value={value.state} onChange={set("state")} autoComplete="address-level1" />
        </div>
      </div>
      {showLabel && (
        <div className="field">
          <span className="field-label">Save as</span>
          <div className="chip-row" role="radiogroup" aria-label="Address type">
            {LABELS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={value.label === l}
                className={"chip-choice" + (value.label === l ? " chip-choice-active" : "")}
                onClick={() => onChange({ ...value, label: l })}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AddressSummary({ address }) {
  return (
    <div className="addr-summary">
      <p className="addr-summary-name">
        {address.name}
        {address.label && <span className="addr-tag">{address.label}</span>}
        {address.isDefault && <span className="addr-tag addr-tag-default">Default</span>}
      </p>
      <p>
        {address.line1}
        {address.line2 ? `, ${address.line2}` : ""}
      </p>
      <p>
        {address.city}, {address.state} – {address.pincode}
      </p>
      <p>Phone: {address.phone}</p>
    </div>
  );
}

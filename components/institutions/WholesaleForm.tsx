"use client";

import { useMemo, useState } from "react";
import { calculateWholesalePrice } from "@/lib/pricing";
import {
  initiateWholesaleCheckout,
  type WholesaleContact,
  type ShippingAddress,
} from "@/lib/checkout";
import { PricingCalculator } from "./PricingCalculator";

/* Form field model ---------------------------------------------------------- */

interface FormState {
  institutionName: string;
  institutionType: string;
  contactName: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  quantity: string; // kept as string so the input can be empty while typing
}

const EMPTY_FORM: FormState = {
  institutionName: "",
  institutionType: "school",
  contactName: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United States",
  quantity: "100",
};

type Errors = Partial<Record<keyof FormState, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form: FormState): Errors {
  const errors: Errors = {};

  if (!form.institutionName.trim())
    errors.institutionName = "Please enter your institution's name.";
  if (!form.contactName.trim())
    errors.contactName = "Please enter a contact person.";

  if (!form.email.trim()) errors.email = "Please enter an email address.";
  else if (!EMAIL_RE.test(form.email.trim()))
    errors.email = "That doesn't look like a valid email address.";

  if (!form.phone.trim()) errors.phone = "Please enter a phone number.";
  else if (form.phone.replace(/\D/g, "").length < 7)
    errors.phone = "Please enter a valid phone number.";

  if (!form.line1.trim()) errors.line1 = "Please enter a street address.";
  if (!form.city.trim()) errors.city = "Please enter a city.";
  if (!form.state.trim()) errors.state = "Please enter a state / region.";
  if (!form.postalCode.trim())
    errors.postalCode = "Please enter a postal code.";
  if (!form.country.trim()) errors.country = "Please enter a country.";

  const qty = Number(form.quantity);
  if (form.quantity.trim() === "") errors.quantity = "Please enter a quantity.";
  else if (!Number.isFinite(qty) || !Number.isInteger(qty))
    errors.quantity = "Quantity must be a whole number.";
  else if (qty < 1) errors.quantity = "Quantity must be at least 1.";

  return errors;
}

/* Component ------------------------------------------------------------------ */

export function WholesaleForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Live pricing derives purely from the quantity field.
  const breakdown = useMemo(() => {
    const qty = Number(form.quantity);
    return calculateWholesalePrice(
      Number.isInteger(qty) && qty > 0 ? qty : NaN
    );
  }, [form.quantity]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear a field's error as soon as the user edits it.
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      // Focus the first invalid field for accessibility.
      const firstKey = Object.keys(nextErrors)[0];
      document.getElementById(firstKey)?.focus();
      setSubmitted(false);
      return;
    }

    const contact: WholesaleContact = {
      institutionName: form.institutionName.trim(),
      institutionType: form.institutionType,
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    };
    const shippingAddress: ShippingAddress = {
      line1: form.line1.trim(),
      line2: form.line2.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim(),
      postalCode: form.postalCode.trim(),
      country: form.country.trim(),
    };

    setLoading(true);
    setServerError(null);

    const res = await initiateWholesaleCheckout({
      contact,
      shippingAddress,
      quantity: Number(form.quantity),
    });

    if (res.error) {
      setServerError(res.error);
      setLoading(false);
    } else {
      setSubmitted(true);
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start"
    >
      {/* Fields ------------------------------------------------------------ */}
      <div className="space-y-6">
        <Fieldset legend="Institution">
          <Field
            id="institutionName"
            label="Institution name"
            value={form.institutionName}
            onChange={(v) => update("institutionName", v)}
            error={errors.institutionName}
            autoComplete="organization"
          />
          <div>
            <Label htmlFor="institutionType">Type of institution</Label>
            <select
              id="institutionType"
              value={form.institutionType}
              onChange={(e) => update("institutionType", e.target.value)}
              className="input"
            >
              <option value="school">School</option>
              <option value="preschool">Preschool / Daycare</option>
              <option value="church">Church</option>
              <option value="library">Library</option>
              <option value="other">Other</option>
            </select>
          </div>
        </Fieldset>

        <Fieldset legend="Contact">
          <Field
            id="contactName"
            label="Contact person"
            value={form.contactName}
            onChange={(v) => update("contactName", v)}
            error={errors.contactName}
            autoComplete="name"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => update("email", v)}
              error={errors.email}
              autoComplete="email"
            />
            <Field
              id="phone"
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={(v) => update("phone", v)}
              error={errors.phone}
              autoComplete="tel"
            />
          </div>
        </Fieldset>

        <Fieldset legend="Shipping address">
          <Field
            id="line1"
            label="Street address"
            value={form.line1}
            onChange={(v) => update("line1", v)}
            error={errors.line1}
            autoComplete="address-line1"
          />
          <Field
            id="line2"
            label="Suite / unit (optional)"
            value={form.line2}
            onChange={(v) => update("line2", v)}
            error={errors.line2}
            autoComplete="address-line2"
            optional
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="city"
              label="City"
              value={form.city}
              onChange={(v) => update("city", v)}
              error={errors.city}
              autoComplete="address-level2"
            />
            <Field
              id="state"
              label="State / region"
              value={form.state}
              onChange={(v) => update("state", v)}
              error={errors.state}
              autoComplete="address-level1"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="postalCode"
              label="Postal code"
              value={form.postalCode}
              onChange={(v) => update("postalCode", v)}
              error={errors.postalCode}
              autoComplete="postal-code"
            />
            <Field
              id="country"
              label="Country"
              value={form.country}
              onChange={(v) => update("country", v)}
              error={errors.country}
              autoComplete="country-name"
            />
          </div>
        </Fieldset>

        <Fieldset legend="Quantity">
          <Field
            id="quantity"
            label="Number of copies"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.quantity}
            onChange={(v) => update("quantity", v)}
            error={errors.quantity}
          />
          <p className="text-sm text-ink-soft">
            Tip: orders of{" "}
            <span className="font-semibold text-ink">
              {breakdown.freeManualThreshold}+
            </span>{" "}
            copies waive the digital fee and include the Teacher&apos;s Master
            Manual free.
          </p>
        </Fieldset>
      </div>

      {/* Sticky live summary + submit ------------------------------------- */}
      <div className="space-y-4 lg:sticky lg:top-24">
        <PricingCalculator breakdown={breakdown} />

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full text-lg flex items-center justify-center gap-2 disabled:opacity-75"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-paper"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                ></path>
              </svg>
              Redirecting to Checkout...
            </>
          ) : (
            "Request Bulk Order & Checkout"
          )}
        </button>

        {serverError && (
          <p
            className="text-center text-sm font-semibold text-clay-dark"
            role="alert"
          >
            {serverError}
          </p>
        )}
      </div>
    </form>
  );
}

/* Small presentational helpers --------------------------------------------- */

function Fieldset({
  legend,
  children,
}: {
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card">
      <legend className="px-2 font-display text-lg font-bold text-ink">
        {legend}
      </legend>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-sm font-semibold text-ink"
    >
      {children}
    </label>
  );
}

interface FieldProps {
  id: keyof FormState & string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text" | "tel" | "email";
  min?: number;
  optional?: boolean;
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  inputMode,
  min,
  optional,
}: FieldProps) {
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {!optional && <span className="text-clay"> *</span>}
      </Label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        min={min}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={["input", error ? "input-error" : ""].join(" ")}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-clay-dark">
          {error}
        </p>
      )}
    </div>
  );
}

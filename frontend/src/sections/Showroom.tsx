import { useState, type FormEvent } from "react";

import { designImages } from "../content/images";
import { ENQUIRIES_CONNECTED, visitPurposes } from "../content/static";
import { useUi } from "../hooks/UiContext";

const inputClass =
  "w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant font-body-sm text-body-sm text-on-surface focus:border-primary outline-none";
const labelClass =
  "block font-label-caps text-label-caps uppercase text-secondary mb-1";

export function Showroom() {
  const { showToast } = useUi();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState(visitPurposes[0]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // TODO: POST to the enquiries endpoint once it exists (it is not built yet).
    showToast(
      ENQUIRIES_CONNECTED
        ? "Asante! Our Karen showroom team will contact you shortly."
        : "Thanks! Enquiries are not connected to the backend yet, so nothing was sent.",
    );
    setName("");
    setPhone("");
  };

  return (
    <section id="showroom-booking" className="w-full bg-surface py-space-3xl">
      <div className="max-w-7xl mx-auto px-margin lg:px-margin-desktop">
        <div className="bg-surface-container-high border border-surface-variant overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-6 relative aspect-[4/3] lg:aspect-auto">
            <img
              className="w-full h-full object-cover"
              alt="The LUXURY Living gallery and workshop in Karen"
              src={designImages.showroom}
            />
            <div className="absolute top-4 left-4 bg-on-surface text-surface px-3 py-1 font-label-caps text-label-caps uppercase tracking-wider">
              Karen Gallery &amp; Workshops
            </div>
          </div>

          <div className="lg:col-span-6 p-space-lg lg:p-space-2xl flex flex-col justify-between">
            <div>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-semibold">
                In-Person Experience
              </span>
              <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">
                Visit The LUXURY Showroom
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs leading-relaxed">
                Experience the weight of our solid hardwoods, test our
                multi-density cushion foam comfort, and consult directly with
                our in-house interior design team along Ngong Road.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md my-space-md py-space-md border-y border-surface-variant">
                <div>
                  <span className="font-label-caps text-label-caps uppercase text-secondary font-bold block mb-1">
                    Location
                  </span>
                  <p className="font-body-sm text-body-sm text-on-surface">
                    Ngong Road (near Karen Roundabout), Nairobi, Kenya
                  </p>
                </div>
                <div>
                  <span className="font-label-caps text-label-caps uppercase text-secondary font-bold block mb-1">
                    Opening Hours
                  </span>
                  <p className="font-body-sm text-body-sm text-on-surface">
                    Mon–Fri: 9:00 AM – 6:00 PM
                    <br />
                    Saturday: 10:00 AM – 5:00 PM
                  </p>
                </div>
              </div>

              <form onSubmit={submit} className="space-y-space-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                  <div>
                    <label htmlFor="visit-name" className={labelClass}>
                      Full Name
                    </label>
                    <input
                      id="visit-name"
                      className={inputClass}
                      placeholder="e.g. Grace Njeri"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="visit-phone" className={labelClass}>
                      Phone / WhatsApp
                    </label>
                    <input
                      id="visit-phone"
                      type="tel"
                      className={inputClass}
                      placeholder="+254 7..."
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="visit-purpose" className={labelClass}>
                    Purpose of Visit
                  </label>
                  <select
                    id="visit-purpose"
                    className={`${inputClass} cursor-pointer`}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  >
                    {visitPurposes.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-space-sm pt-space-xs">
                  <button
                    type="submit"
                    className="h-12 px-space-lg bg-primary-container text-on-primary font-label-lg text-label-lg hover:bg-primary transition-colors"
                  >
                    Book Showroom Visit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurpose(visitPurposes[2])}
                    className="h-12 px-space-lg border border-on-secondary-fixed text-on-secondary-fixed font-label-lg text-label-lg hover:bg-on-secondary-fixed hover:text-surface transition-colors"
                  >
                    Request Free Swatches
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

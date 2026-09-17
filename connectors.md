# Connector boundary

Every connector is a synchronous mock behind `verify`, `fetch`, or `lookup`. Each call records success or failure in `connectorLogs`; failures return a manual-verification result so a registry outage does not become an application 500.

| Connector | Stands in for | Real integration would require | Prototype status |
|---|---|---|---|
| Aadhaar e-KYC | UIDAI-authorized identity verification | AUA/KUA authorization, signed requests, approved data contract and privacy controls | Mock format check only |
| PAN structural validation | Public PAN format rules | A full live status check still requires restricted Income Tax/GSTN access | Local structure and holder-type validation only; no live status claim |
| Ration DB | Legacy Food & Civil Supplies registry | Department agreement, legacy adapter or file-feed access and field mapping | Always returns no match |
| Income Registry | Revenue Department income records | Department authorization, citizen consent, secure API credentials and income schema | Returns a fixed demo income |
| Caste Registry | State caste/domicile certificate registry | Social Welfare authorization, certificate identifier contract and licensing/usage approval | Echoes supplied category as verified |
| India Post Pincode | India Post postal directory | Public API availability and network access | Real lookup of district/state; no signup required |
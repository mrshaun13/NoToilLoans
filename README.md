# No Toil Loans

A ledger for cheap personal loans between people who trust each other.

**Live:** [loans.toil404.com](https://loans.toil404.com/)

Set the amount, rate, and payment. Strike a note as a single HTML file. The lender e-signs in the app, downloads that file, and emails it to the borrower. The borrower e-signs inside the file and emails it back. Bring the file back later to log extra payments or new terms. History through that date stays; everything after is recalculated.

No accounts. No database. Drafts live in the browser. Struck notes are files you keep.

## How interest works

Declining-balance **simple interest**, **actual/365**. Interest is computed on the remaining principal between payment dates, not as bank-style amortization.

```
interest = balance × rate × days / 365
```

Scheduled deposits are assumed on time. Extra payments of any size are allowed. Payoff is recalculated at payment time.

Frequencies: weekly, every two weeks, twice a month, monthly.

## Strike a note

Dial in the terms, add both names, and e-sign as the lender. The signed HTML file downloads, and your email app opens with a subject and message — attach the file yourself and send it to the borrower. Open that file later to see what is owed **as of today**. Import it back into the app to:

- record an extra payment
- change payment, rate, or frequency
- see the impact on payoff time and interest
- export an updated note (e-sign again only if the payment, rate, or frequency changed)

When terms change, the old path stays on the chart as a dashed comparison line.

## Promissory note

Each struck file includes an agreement covering principal, rate, payment, actual/365 simple interest, extra payments, term changes, and prepayment.

The lender e-signs when the note is struck. The signature is a typed name in the file, not an account with a third party. After a change to the payment, rate, or frequency, the lender e-signs again and the borrower signature is cleared. An extra payment keeps the signatures already on that version.

The borrower opens the HTML file (they do not need the app), gets a one-time prompt, reviews the note, and e-signs. A dual-signed copy downloads and their email app opens so they can attach it and send it back. Once both have signed, that version's signatures stay locked.

The agreement is a template, not legal advice.

## Run it locally

```bash
npm install
npm run dev
```

Open the printed URL. `npm run build` produces a static site.

## Hosting

GitHub Pages, served at the root of [https://loans.toil404.com/](https://loans.toil404.com/). Push to `main` and the Actions workflow deploys it.

## Privacy

This repository does not contain anyone’s loan. Lender and borrower names are typed in at strike time and written only into the HTML file you download. Do not commit struck notes that have real names or amounts.

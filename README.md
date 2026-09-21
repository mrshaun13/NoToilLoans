# No Toil Loans

A ledger for cheap personal loans between people who trust each other.

**Live:** [mrshaun13.github.io/NoToilLoans](https://mrshaun13.github.io/NoToilLoans/)

Set the amount, rate, and payment. Strike a note as a single HTML file. Bring that file back later to log extra payments or new terms. History through that date stays; everything after is recalculated. Both parties can print and sign the agreement.

No accounts. No database. Drafts live in the browser. Struck notes are files you keep.

## How interest works

Declining-balance **simple interest**, **actual/365**. Interest is computed on the remaining principal between payment dates, not as bank-style amortization.

```
interest = balance × rate × days / 365
```

Scheduled deposits are assumed on time. Extra payments of any size are allowed. Payoff is recalculated at payment time.

Frequencies: weekly, every two weeks, twice a month, monthly.

## Strike a note

Dial in the terms, add names for the printable agreement, and download a self-contained HTML file. Open that file later to see what is owed **as of today**. Import it back into the app to:

- record an extra payment
- change payment, rate, or frequency
- see the impact on payoff time and interest
- export an updated note

When terms change, the old path stays on the chart as a dashed comparison line.

## Promissory note

Each struck file includes a printable agreement covering:

- lender and borrower names
- principal, rate, and payment
- actual/365 simple interest, calculated on the payment date
- extra payments of any size
- term changes
- prepayment
- signature lines

The agreement is a template, not legal advice.

## Run it locally

```bash
npm install
npm run dev
```

Open the printed URL (the app is served under `/NoToilLoans/`, same as GitHub Pages). `npm run build` produces a static site.

## Hosting

GitHub Pages. Push to `main` and the Actions workflow deploys [https://mrshaun13.github.io/NoToilLoans/](https://mrshaun13.github.io/NoToilLoans/).

## Privacy

This repository does not contain anyone’s loan. Lender and borrower names are typed in at strike time and written only into the HTML file you download. Do not commit struck notes that have real names or amounts.

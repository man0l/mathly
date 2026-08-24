#!/usr/bin/env node
/**
 * Idempotent RevenueCat catalog setup for Mathly, driven by the REST API v2
 * management key (REVENUECAT_MANAGEMENT_KEY, a `sk_…` secret — never ship it
 * to clients).
 *
 * Ensures that the current offering has both checkout plans wired for every
 * storefront, which is what keeps the Subscribe button alive in release
 * builds:
 *
 *   $rc_annual ← mathly_pro_yearly   (App Store, Play Store, Test Store)
 *   $rc_weekly ← mathly_pro_weekly   (App Store, Play Store, Test Store)
 *
 * The Play/App Store products themselves sync from the stores; the Test Store
 * ones are created here if missing (that is what enables simulated real
 * checkouts without App Store / Play review state).
 *
 * Usage: REVENUECAT_MANAGEMENT_KEY=sk_… node scripts/revenuecat-setup-catalog.mjs
 */

const API = 'https://api.revenuecat.com/v2';

/** Resource IDs of the Mathly project (see `GET /v2/projects`). */
const APPS = {
  play: { id: 'app522590ec1c', label: 'Play Store' },
  appStore: { id: 'appc72193ce0c', label: 'App Store' },
  // The Test Store lets purchases be simulated end-to-end without either
  // real store being in a reviewable state.
  test: { id: 'app44d19bca38', label: 'Test Store', createsProducts: true },
};

/** Plan → package lookup_key plus each storefront's product identifier. */
const PLANS = [
  {
    plan: 'yearly',
    lookupKey: '$rc_annual',
    title: 'Mathly Pro Yearly',
    duration: 'P1Y',
    identifiers: {
      play: 'com.balkanbit.mathly.yearly:yearly',
      appStore: 'com.balkanbit.mathly.yearly',
      test: 'mathly_pro_yearly',
    },
  },
  {
    plan: 'weekly',
    lookupKey: '$rc_weekly',
    title: 'Mathly Pro Weekly',
    duration: 'P1W',
    identifiers: {
      play: 'com.balkanbit.mathly.weekly:weekly',
      appStore: 'com.balkanbit.mathly.weekly',
      test: 'mathly_pro_weekly',
    },
  },
];

const key = process.env.REVENUECAT_MANAGEMENT_KEY;
if (!key) {
  console.error('REVENUECAT_MANAGEMENT_KEY (REST API v2 secret key) is not set.');
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} -> HTTP ${res.status}: ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

async function paginate(path) {
  const items = [];
  let url = path;
  while (url) {
    const page = await api('GET', url);
    items.push(...page.items);
    url = page.next_page ? `${path}${page.next_page}` : null;
  }
  return items;
}

function die(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// --- Discover the project -------------------------------------------------

const projects = await api('GET', '/projects');
if (projects.items.length !== 1) {
  die(
    `Expected exactly one accessible project, found ${projects.items.length}: ` +
      projects.items.map((p) => p.name).join(', '),
  );
}
const project = projects.items[0];
console.log(`Project: ${project.name} (${project.id})`);

// --- Ensure every plan has its package in the current offering ------------

const offerings = await paginate(`/projects/${project.id}/offerings`);
const current = offerings.find((o) => o.is_current) ?? offerings[0];
if (!current) die('No offerings exist — create one in the dashboard first.');
console.log(`Current offering: ${current.lookup_key} (${current.id})`);

const packages = await paginate(
  `/projects/${project.id}/offerings/${current.id}/packages`,
);

for (const plan of PLANS) {
  let pkg = packages.find((p) => p.lookup_key === plan.lookupKey);
  if (!pkg) {
    pkg = await api('POST', `/projects/${project.id}/offerings/${current.id}/packages`, {
      lookup_key: plan.lookupKey,
      display_name: plan.title,
    });
    console.log(`+ created package ${plan.lookupKey} (${pkg.id})`);
  }

  const attached = new Set(
    (
      await paginate(`/projects/${project.id}/packages/${pkg.id}/products`)
    ).map((it) => it.product.id),
  );

  for (const [storeKey, app] of Object.entries(APPS)) {
    const identifier = plan.identifiers[storeKey];
    let product = (await paginate(`/projects/${project.id}/products`)).find(
      (p) => p.app_id === app.id && p.store_identifier === identifier,
    );
    if (!product) {
      if (!app.createsProducts) {
        die(
          `Product ${identifier} is missing for the ${app.label} app — it must sync ` +
            'from the store (or be created in the dashboard) before it can be attached.',
        );
      }
      product = await api('POST', `/projects/${project.id}/products`, {
        app_id: app.id,
        store_identifier: identifier,
        type: 'subscription',
        subscription: { duration: plan.duration },
        title: plan.title,
      });
      console.log(`+ created ${app.label} product ${identifier} (${product.id})`);
    }

    if (!attached.has(product.id)) {
      await api(
        'POST',
        `/projects/${project.id}/packages/${pkg.id}/actions/attach_products`,
        { products: [{ product_id: product.id, eligibility_criteria: 'all' }] },
      );
      console.log(`+ attached ${app.label} ${identifier} → ${plan.lookupKey}`);
    }
  }
}

// --- Verify like the e2e preflight does -----------------------------------

const verify = await paginate(
  `/projects/${project.id}/offerings/${current.id}/packages`,
);
let failures = 0;
for (const plan of PLANS) {
  const pkg = verify.find((p) => p.lookup_key === plan.lookupKey);
  const count = pkg
    ? (
        await paginate(`/projects/${project.id}/packages/${pkg.id}/products`)
      ).length
    : 0;
  if (count > 0) console.log(`✓ ${plan.lookupKey} has ${count} product(s) attached`);
  else {
    console.error(`✗ ${plan.lookupKey} has no products attached`);
    failures += 1;
  }
}
process.exit(failures ? 1 : 0);

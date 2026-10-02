/* The Morning Owl marketing diagnostic: flow builder and diagnostic rules.
   No AI. Every finding below is a named rule with explicit answer conditions,
   so what the visitor sees can always be traced back to what they chose. */
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./diagnostic-data.js') : root.TMO_DATA;
  var BR = D.BR, O = D.O;

  /* ================= FLOW ================= */

  function find(opts, code) { for (var i = 0; i < opts.length; i++) if (opts[i].code === code) return opts[i]; return null; }
  function resolve(def, c) { return typeof def === 'function' ? def(c) : def; }
  // Every choice question offers an honest way out when the visitor may not know
  function withNotSure(o) { return o.some(function (x) { return x.x; }) ? o : o.concat([O('not_sure', 'Not sure', { x: true })]); }

  // Filter a destination branch's Q3 when arriving from another branch, so we never re-ask what we already know
  function q3For(b, from, fromCode) {
    var base = BR[b].q3, o = base.o;
    if (b === 'A' && from === 'I' && fromCode === 'own_web') o = o.filter(function (x) { return ['website', 'dm', 'other'].indexOf(x.code) >= 0; });
    if (b === 'A' && from === 'I' && fromCode === 'marketplace') o = o.filter(function (x) { return ['marketplace', 'tiktok'].indexOf(x.code) >= 0; });
    if (b === 'D' && (from === 'I' || from === 'GP')) o = o.filter(function (x) { return x.code !== 'online'; });
    var t = base.t;
    if (b === 'A' && from) t = 'Which of these is your main online sales route?';
    if (b === 'D' && from) t = 'Which in-store sales journey do you want to improve?';
    return { t: t, help: base.help, o: o };
  }

  function route(a) {
    var r = { industry: a.q1 || null, neutral: false, chain: [], branch: null, sub: null, resolved: false, gp: false };
    if (!a.q1) return r;
    var b = a.q1;
    if (b === 'other') {
      if (!a.r1) return r;
      var ro = find(D.R1, a.r1); if (!ro) return r;
      b = ro.to; r.neutral = !!ro.neutral;
    }
    var from = null, fromCode = null, guard = 0;
    while (guard++ < 5) {
      r.chain.push({ b: b, from: from, fromCode: fromCode });
      r.branch = b;
      var sel = a[b + '.q3'];
      if (!sel) return r;
      var opt = find(q3For(b, from, fromCode).o, sel);
      if (!opt) return r;
      if (opt.to === 'GP') {
        r.gp = true;
        if (!a.gp) return r;
        var g = find(D.GP.o, a.gp); if (!g) return r;
        from = 'GP'; fromCode = a.gp; b = g.to; continue;
      }
      if (opt.to) { from = b; fromCode = sel; b = opt.to; continue; }
      r.sub = sel; r.resolved = true; return r;
    }
    return r;
  }

  // Context used by both the question wording and the rules
  function context(a) {
    var r = route(a), b = r.branch;
    var c = { a: a, route: r, b: b, sub: r.sub, neutral: r.neutral };
    if (!b) return c;
    var oc = D.outcomeFor(b, r.sub, r.neutral);
    c.o = oc.o; c.P = oc.people; c.longCycle = !!BR[b].longCycle || r.neutral;
    c.q5opts = BR[b].q5.concat([O('other', 'Other (tell us)', { txt: true })]);
    c.goal = a[b + '.q4'] || null;
    return c;
  }

  function goalVariant(c) {
    var g = c.goal; if (!g) return null;
    if (g === 'unclear') return 'measure';
    return g;
  }

  // Build the ordered list of steps for the current answers
  function buildSteps(a) {
    var steps = [], r = route(a);
    steps.push({ key: 'q1', t: 'What type of business do you run?', help: 'Choose one. If more than one fits, choose the area you want this check to focus on.', o: D.INDUSTRIES });
    if (a.q1 === 'other') {
      steps.push({ key: 'r1', t: 'How do customers mainly buy from you?', o: D.R1 });
      if (a.r1 === 'another') steps.push({ key: 'r1_desc', t: 'Briefly describe how someone becomes a paying customer.', text: true, optional: true, placeholder: 'For example: they see our stall at events, then order by phone' });
    }
    if (!a.q1) return steps;
    if (!r.branch) return steps;
    var c = context(a);
    r.chain.forEach(function (link) {
      var q = q3For(link.b, link.from, link.fromCode);
      steps.push({ key: link.b + '.q3', t: q.t, help: q.help, o: q.o });
      if (link.b === 'G' && a['G.q3'] === 'products') steps.push({ key: 'gp', t: D.GP.t, o: D.GP.o });
    });
    if (!r.resolved) return steps;
    var b = c.b;
    steps.push({ key: b + '.q4', t: 'What would you most like to improve?', help: 'Choose the one you most want this check to focus on.', o: resolve(BR[b].q4, c).o });
    steps.push({ key: b + '.q5', t: 'Where are you currently marketing this part of your business?', help: 'Select all that apply.', multi: true,
      o: c.q5opts.concat([O('none', 'Not actively marketing', { x: true })]) });
    steps.push(Object.assign({ key: 'q6' }, D.q6(c)));
    // Repeat-business goals skip pre-purchase questions, unless this industry's drop-off question covers after-purchase stages.
    var post = c.goal === 'retain' || c.goal === 'renew';
    var q7 = resolve(BR[b].q7, c);
    var askQ7 = !(post && !q7.o.some(function (x) { return x.st === 'retain' || x.st === 'attendance'; }));
    if (askQ7) steps.push({ key: b + '.q7', t: q7.t, help: q7.help, o: q7.o });
    var q8 = resolve(BR[b].q8, c);
    if (!(post && BR[b].q8pre)) {
      var o8 = withNotSure(q8.o);
      steps.push({ key: b + '.q8', t: q8.t, help: q8.max ? 'Choose up to two.' : null, max: q8.max, multi: !!q8.max, o: o8, refer: q8.refer });
    }
    var gv = goalVariant(c);
    if (gv) {
      // "Is the drop-off concentrated anywhere?" needs them to know where the drop-off is. Skip it if they said they don't.
      var needsDrop = (b === 'A' || b === 'D') && gv === 'convert';
      if (!(needsDrop && a[b + '.q7'] === 'unknown')) {
        var q9 = resolve(BR[b].q9[gv], c);
        var o9 = withNotSure(q9.o.slice());
        if (!find(o9, 'na')) o9.push(D.NA);
        if (!find(o9, 'other')) o9.push(O('other', 'Other (tell us)', { txt: true }));
        steps.push({ key: b + '.q9.' + gv, t: q9.t, o: o9 });
      }
      // Where customers come from: only asked when it changes the result (no active marketing, or growing what already works).
      // Otherwise the measurement question below covers what they can see.
      var ch = a[b + '.q5'] || [];
      if (ch.indexOf('none') >= 0 || a.q6 === 'improving') steps.push(Object.assign({ key: 'q10' }, D.q10(c, ch)));
      steps.push(Object.assign({ key: 'q11' }, D.q11(c)));
      steps.push(Object.assign({ key: 'q12' }, D.q12(c)));
      var tried = (a.q12 || []).filter(function (x) { return x !== 'nothing'; });
      if (tried.length) steps.push(Object.assign({ key: 'q12b' }, D.q12b(tried.length)));
    }
    return steps;
  }

  // Remove answers that no longer belong to the current route, and option values that no longer exist
  function prune(a) {
    var changed = true, guard = 0;
    while (changed && guard++ < 6) {
      changed = false;
      var steps = buildSteps(a), keys = {};
      steps.forEach(function (s) { keys[s.key] = s; });
      Object.keys(a).forEach(function (k) {
        if (k.charAt(0) === '_') return; // internal markers, not answers
        var base = k.split(':')[0];
        if (!keys[base]) { delete a[k]; changed = true; return; }
        if (k.indexOf(':') >= 0) return;
        var s = keys[base];
        if (s.text) return;
        var valid = s.o.map(function (x) { return x.code; });
        if (Array.isArray(a[k])) {
          var f = a[k].filter(function (v) { return valid.indexOf(v) >= 0; });
          if (f.length !== a[k].length) { a[k] = f; changed = true; }
          if (!f.length) { delete a[k]; changed = true; }
        } else if (valid.indexOf(a[k]) < 0) { delete a[k]; changed = true; }
      });
      // drop orphaned "other" text
      Object.keys(a).forEach(function (k) {
        if (k.indexOf(':txt') < 0) return;
        var base = k.split(':')[0], v = a[base];
        var holder = Array.isArray(v) ? v : [v];
        var s = keys[base]; if (!s) return;
        var txtCodes = s.o.filter(function (x) { return x.txt; }).map(function (x) { return x.code; });
        if (!holder.some(function (x) { return txtCodes.indexOf(x) >= 0; })) { delete a[k]; }
      });
    }
    return a;
  }

  /* ================= RULES ================= */

  function lc(s) { if (!s) return s; if (s.length > 1 && s[1] === s[1].toUpperCase() && /[A-Z]/.test(s[1])) return s; return s.charAt(0).toLowerCase() + s.slice(1); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var REFER = { q3: 'your main sales route is', q4: 'you want to', q5: 'you market through', q6: 'over the last three months,',
    q7: 'most people stop at', q9: 'you said', q10: 'you think your best channels are', q11: 'you track results through' };

  function helpers(c, steps) {
    var byName = {};
    steps.forEach(function (s) {
      var n = s.key.indexOf('.q') >= 0 ? s.key.split('.')[1] : s.key;
      byName[n] = s;
    });
    c.steps = byName;
    c.val = function (q) { var s = byName[q]; return s ? c.a[s.key] : undefined; };
    c.is = function (q) { var v = c.val(q), codes = Array.prototype.slice.call(arguments, 1); if (v === undefined) return false;
      var arr = Array.isArray(v) ? v : [v]; return arr.some(function (x) { return codes.indexOf(x) >= 0; }); };
    c.label = function (q, code) { var s = byName[q]; if (!s) return ''; var o = find(s.o, code); return o ? o.label : ''; };
    c.ev = function (q, code, w) {
      var v = c.val(q); if (v === undefined) return null;
      var arr = Array.isArray(v) ? v : [v];
      if (code && arr.indexOf(code) < 0) return null;
      var codes = code ? [code] : arr;
      var labels = codes.map(function (x) { return c.label(q, x); }).filter(Boolean);
      if (!labels.length) return null;
      return { q: q, code: code || arr[0], w: w === undefined ? 1 : w, question: byName[q].t, answer: labels.join('; '),
        pre: (q === 'q8' ? (byName.q8.refer || 'you said') : q === 'q9' ? q9Refer(c) : REFER[q]), labs: labels.map(lc),
        refer: (q === 'q8' ? (byName.q8.refer || 'you said') : q === 'q9' ? q9Refer(c) : REFER[q]) + ' “' + labels.map(lc).join('” and “') + '”' };
    };
    // evidence for any of these codes on q
    c.any = function (q, codes, w) { var out = []; codes.forEach(function (x) { var e = c.ev(q, x, w); if (e) out.push(e); }); return out; };
    c.st7 = (function () { var s = byName.q7; if (!s) return null; var o = find(s.o, c.a[s.key]); return o ? (o.st || null) : null; })();
    c.linked = c.is('q11', 'platform', 'analytics', 'records', 'codes');
    c.weakTracking = c.is('q11', 'none') || (c.is('q11', 'reach') && !c.linked);
    // Previous attempts: structured selections only. Free text is context and is never parsed.
    c.attempts = (Array.isArray(c.a.q12) ? c.a.q12 : []).filter(function (x) { return x !== 'nothing'; });
    c.nothingTried = Array.isArray(c.a.q12) && c.a.q12.indexOf('nothing') >= 0;
    c.outcome = c.attempts.length ? (c.a.q12b || 'unknown') : null;
    c.otherTxt = (c.a['q12:txt'] || '').trim();
    c.notes = (c.a._legacyNote || '').trim();   // only from reports saved by earlier versions
    // Channels: phrase reports around what they actually use
    var ch = c.val('q5') || [];
    c.paid = ch.some(function (x) { return PAID.indexOf(x) >= 0; });
    c.adRep = c.paid ? 'your ad reports' : 'your page, profile or listing insights';
    c.local = c.b === 'C' || c.b === 'D';
    return c;
  }

  var Q9_TOPIC = {
    A: { acquire: 'the people your marketing reaches', convert: 'where the drop-off concentrates', cost: 'orders from your marketing', retain: 'repeat buying', measure: 'judging performance' },
    B: { acquire: 'new signups or leads', convert: 'what holds new users back', cost: 'how far you can follow acquired users', retain: 'users who leave', measure: 'your measurement gap' },
    C: { acquire: 'who your marketing attracts', convert: 'what holds people back', promo: 'your promotions', retain: 'return visits', measure: 'connecting marketing to orders' },
    D: { acquire: 'who your marketing reaches', convert: 'where the problem concentrates', promo: 'your promotions', retain: 'encouraging another visit', measure: 'the information you are missing' },
    E: { acquire: 'what your marketing makes clear', viewings: 'what happens after an enquiry', close: 'what delays agreements', cost: 'judging a qualified enquiry', measure: 'following enquiries to their source' },
    F: { acquire: 'what your marketing explains', meetings: 'what happens after an enquiry', close: 'why prospects do not proceed', cost: 'acquisition cost and client value', renew: 'why clients do not renew', measure: 'where source information stops' },
    G: { acquire: 'how well enquiries match your services', convert: 'the next step after an enquiry', noshow: 'missed appointments', retain: 'follow-up visits', measure: 'connecting outcomes to sources' },
    H: { acquire: 'how well enquiries match your programme', convert: 'what happens after a trial or consultation', attend: 'why people stop', renew: 'what happens after the first programme', measure: 'following people from their source' },
    I: { demand: 'how shoppers understand your product', convert: 'what interested shoppers ask', promo: 'your promotions', retain: 'buying again', measure: 'the sales information you can access' } };
  function q9Refer(c) { var g = c.goal === 'unclear' ? 'measure' : c.goal; var t = (Q9_TOPIC[c.b] || {})[g]; return t ? 'when we asked about ' + t + ', you said' : 'you said'; }

  var PAID = ['meta', 'google', 'tiktok_ads', 'mkt_ads', 'search_ads', 'linkedin', 'gmaps_ads', 'portals', 'appstore_ads', 'retail_media', 'platform_promos'];
  var SINGLE = { A: 'order', B: 'customer', C: 'order or visit', D: 'purchase', E: 'sale or lease', F: 'client', G: 'appointment', H: 'enrolment', I: 'purchase' };

  /* Each rule: id, goals (priorities it serves), pri (tie-break weight), when(c) -> evidence[] | null,
     area(c), link(c), impact(c), why(c) [<=2 possible explanations], check(c), action(c), confirm(c), record(c) */
  var RULES = [];
  function R(def) { RULES.push(def); }
  // A possible explanation, the check that would confirm or rule it out, and the attempt codes that address it.
  function E(cause, check, fix) { return { c: cause, k: check, fix: fix || [] }; }

  /* ---- Ecommerce: final cost and checkout ---- */
  R({ id: 'checkout', goals: ['convert', 'cost'], pri: 4,
    when: function (c) { if (c.b !== 'A') return null;
      var e = c.any('q7', ['checkout', 'before_checkout', 'after_price', 'after_payinfo', 'cancel']);
      var extra = c.any('q8', ['delivery', 'payment']).concat(c.any('q9', ['mobile']));
      if (!e.length && !(extra.length && (c.goal === 'convert'))) return null;
      return e.concat(extra); },
    mode: function (c) { if (c.sub === 'dm') return 'dm'; if (c.sub === 'marketplace' || c.sub === 'tiktok') return 'mkt';
      if (c.is('q8', 'delivery')) return 'delivery'; if (c.is('q8', 'payment')) return 'payment';
      if (c.is('q9', 'mobile')) return 'mobile'; return 'generic'; },
    area: function (c) { return { dm: 'the step where customers receive the total price and payment details', mkt: 'why orders are cancelled or left unpaid',
      delivery: 'the total cost shoppers see before paying', payment: 'payment options at checkout', mobile: 'the mobile checkout journey', generic: 'checkout completion' }[this.mode(c)]; },
    link: function () { return 'Getting to checkout shows real interest, even if not everyone there has made up their mind. Something at that last step may be putting some of them off.'; },
    impact: function (c) { return 'You’ve already paid to get these people this far, so losing them at the last step is one of the more expensive places to lose anyone.'; },
    why: function (c) { return {
      dm: [E('The total with delivery may differ from what customers expected when they first asked.', 'Look at 20 conversations that went quiet after the total was sent. If many stopped right after seeing it, the total is the likely issue. If they stopped earlier, look elsewhere.', ['delivery', 'pricing']),
        E('Payment steps sent by message may feel slow or uncertain, so people put them off.', 'In the same conversations, note how long it took to send payment details. If slow replies went quiet more often than fast ones, the payment step is the likely issue.', ['checkout', 'response'])],
      mkt: [E('Delivery fees or times shown at the final step may change the decision.', 'Group cancelled and unpaid orders by the reason in your seller centre. If delivery comes up most, that’s your answer. If it barely shows up, look elsewhere.', ['delivery']),
        E('Some orders may fail on payment method or cash-on-delivery rules.', 'Check how many unpaid or cancelled orders used cash on delivery or had a failed payment. If that’s a big chunk of them, payment is likely the problem.', ['checkout'])],
      delivery: [E('Delivery charges or delivery times may appear later than shoppers expect.', 'Note where the full delivery cost first appears on a phone and on a computer, then compare how many shoppers leave at that step with the step before. If lots of people drop off right there, that’s probably it.', ['delivery']),
        E('Checkout itself may add friction, such as forced account creation or limited payment choices.', 'Place a test order on a phone and note every extra step, then check failed payments in your payment provider’s report. Forced steps or many failures support this.', ['checkout'])],
      payment: [E('The payment methods your shoppers prefer may be missing or failing.', 'Compare the methods shoppers ask for with the ones you offer, and check failed payments by method. If a method people want is missing, or one keeps failing, that’s likely it.', ['checkout']),
        E('Some shoppers may reach checkout only to see the final total before deciding.', 'Check whether delivery or fees are added at checkout. If the total rises noticeably there and many leave at that step, this is likely part of it.', ['delivery', 'pricing'])],
      mobile: [E('The payment or form steps may be harder to complete on a phone.', 'Compare checkout completion on mobile and desktop for the same period, and place a test order on a phone. If phones do much worse, the phone checkout is the likely culprit.', ['checkout', 'speed']),
        E('Mobile shoppers may arrive from ads with lower intent than desktop shoppers.', 'Compare mobile checkout completion for shoppers from ads with mobile shoppers from other sources. If only ad traffic is weak, intent is more likely than the phone journey.', ['targeting', 'creative'])],
      generic: [E('The final cost, including delivery, may be higher than shoppers expected.', 'Compare how many shoppers leave at the step where delivery and fees are added with the step before. If people bail right at that point, the extra cost is probably what’s putting them off.', ['delivery', 'pricing']),
        E('A usability or technical problem, possibly on mobile, may be stopping some payments.', 'Check failed payments in your payment provider’s report and place a test order on a phone. If you hit errors or see lots of failed payments, it’s a technical problem.', ['checkout', 'speed'])] }[this.mode(c)]; },
    check: function (c) { return { dm: 'Take your last 20 enquiries that went quiet and note the message each one stopped replying after.',
      mkt: 'Review your seller centre’s cancellation and unpaid-order reasons for the last 60 days.',
      delivery: 'Check whether shoppers can see the full delivery cost before they start checkout.',
      payment: 'Compare the payment methods you offer with the ones shoppers ask for, and check your payment provider’s failed-payment report.',
      mobile: 'Compare checkout starts and completed orders on mobile versus desktop.',
      generic: 'Compare checkout starts with completed orders and note the step where most shoppers leave.' }[this.mode(c)]; },
    action: function (c) { var m = this.mode(c);
      if (m === 'dm') return 'Tag last month’s message enquiries in your inbox or WhatsApp by where they stopped (asked about the product, received the total, received payment details). This tells you whether the price, the delivery terms or the payment step is where people drop.';
      if (m === 'mkt') return 'Export cancelled and unpaid orders from your seller centre and group them by the reason given. This shows whether delivery, payment method or a change of mind is behind most of the losses.';
      return 'Compare checkout starts and completed orders by device in your store analytics. If one device or step is noticeably weaker within your own data, look at that journey first before changing your ad targeting.'; },
    confirm: function (c) { return c.sub === 'dm' ? 'A sample of message threads that did not become orders' : (c.sub === 'marketplace' || c.sub === 'tiktok') ? 'Your seller-centre order reports' : 'Checkout-stage data'; },
    record: function (c) { return c.sub === 'dm' ? 'A sample of message threads that did not become orders' : (c.sub === 'marketplace' || c.sub === 'tiktok') ? 'Seller-centre cancellation and unpaid-order reports' : 'Checkout-stage data: checkout starts, payment attempts and completed orders'; } });

  /* ---- Ecommerce: product page / interest to cart ---- */
  R({ id: 'product_page', goals: ['convert'], pri: 3,
    when: function (c) { if (c.b !== 'A') return null;
      var e = c.any('q7', ['before_cart', 'after_ask', 'listing_no_order']);
      var s = c.any('q8', ['fit', 'trust']).concat(c.any('q9', ['few_products']));
      if (!e.length && !(s.length >= 2)) return null;
      if (!e.length && !c.is('q8', 'fit', 'trust')) return null;
      return e.concat(s); },
    area: function (c) { return c.sub === 'dm' ? 'the answers customers get when they ask about a product' : 'how clearly your product pages answer shoppers’ questions'; },
    link: function () { return 'People are turning up and looking around, so the gap may be somewhere between “this looks interesting” and actually buying.'; },
    impact: function (c) { return 'You’ve already paid to bring these visitors in, so if this step gets better you could get more ' + c.o + ' without spending more on reach.'; },
    why: function () { return [E('Product pages may not answer questions about fit, use or quality that shoppers care about.', 'List the questions shoppers ask most and check each product page for the answer near the price. If your busiest pages don’t answer them, that’s likely why people hesitate.', ['pages', 'proof']),
      E('Some visitors may be browsing or comparing rather than ready to buy.', 'Compare add-to-cart rates by traffic source. If one source is far weaker than the rest, the problem is probably who that source sends you, rather than your pages.', ['targeting', 'creative'])]; },
    check: function () { return 'List the questions shoppers ask most often and check whether each product page answers them near the price.'; },
    action: function (c) { return c.sub === 'dm' ? 'Collect the ten questions customers ask most before going quiet, and check whether your standard replies answer them in the first message. This helps you decide whether the gap is information or price.' :
      'Compare views with add-to-cart numbers for your three most-viewed products in your store analytics or seller reports. If one stands out as weak, review that page against the questions shoppers ask before changing the others.'; },
    confirm: function () { return 'Product-level view and add-to-cart data'; },
    record: function () { return 'Product-level views and add-to-cart numbers'; } });

  /* ---- Reach and audience fit (all branches with a reach problem) ---- */
  R({ id: 'reach_fit', goals: ['acquire', 'demand'], pri: 2,
    when: function (c) {
      var e = [];
      if (c.st7 === 'reach') e = e.concat(c.ev('q7') ? [c.ev('q7')] : []);
      e = e.concat(c.any('q9', ['few_see', 'no_click', 'wrong_want', 'outside_area', 'too_far', 'wrong_people', 'wrong_price', 'too_few', 'not_promoted']));
      if (c.b === 'C') e = e.concat(c.any('q9', ['location']));
      if (!e.length) return null;
      if (c.is('q6', 'spend_up_flat')) e.push(c.ev('q6', null, 0.5));
      return e; },
    area: function (c) { return c.local ? 'whether your marketing reaches people who can realistically visit or order' : 'who your marketing is reaching'; },
    link: function (c) { return 'The problem may start earlier than you’d think, with who sees your marketing and why they respond to it.'; },
    impact: function (c) { return 'If your marketing mostly reaches people who were never going to buy, spending more just buys you more attention, with no extra ' + c.o + ' to show for it.'; },
    why: function (c) {
      if (c.is('q9', 'few_see', 'too_few', 'not_promoted')) return [E('Budget or reach may be too limited to build awareness among the right people.', 'Compare how many relevant people you reached each month with how many became ' + c.o + '. If people respond well but there just aren’t many of them, you need more reach.', ['budget', 'new_channel']),
        E('Your visibility in search, maps or listings may be low where people look for what you sell.', 'Search for what you sell the way a customer would, in your area, and note where you appear. If you’re hard to find, that’s a big part of it.', ['local', 'pages'])];
      if (c.local) return [E('Targeting may reach people who live or work too far away to visit.', 'Compare the location breakdown in ' + c.adRep + ' with where recent customers come from. If a lot of them are too far away to ever visit, your targeting is too wide.', ['targeting']),
        E('The message or offer may appeal to a different price range or occasion than yours.', 'Ask ten recent enquirers or visitors what they expected to pay or find. Frequent mismatches support this.', ['creative'])];
      return [E('Targeting or placements may reach people outside your realistic customer base.', 'Compare the audience, placement and location breakdown in ' + c.adRep + ' with the profile of people who bought. If they look like different people, you’re paying to reach the wrong crowd.', ['targeting']),
        E('The message may attract clicks from people looking for something you do not sell.', 'Read the search terms or comments that led people to you, where available. Many unrelated needs support this.', ['creative'])]; },
    check: function (c) { return c.local ? 'Check the location breakdown in ' + c.adRep + ' against a realistic travel distance around your outlet.' :
      c.is('q9', 'few_see', 'too_few', 'not_promoted') ? 'Compare how many relevant people your marketing reaches each month, by source, with how many go on to buy, to see whether the limit is reach or response.' :
      'Compare where clicks come from (placement, audience, location) with the profile of people who went on to buy.'; },
    action: function (c) { return 'Open the audience and location breakdown in ' + c.adRep + ' and compare it with the profile of recent paying customers. If they differ noticeably, adjust who you reach' + (c.paid ? ' before deciding whether to change the budget.' : ' before adding paid marketing.'); },
    confirm: function () { return 'An audience and location breakdown from your ad reports'; },
    record: function () { return 'Ad reports broken down by location, placement and audience, next to recent customer locations or profiles'; } });

  /* ---- Clicks vs visits gap ---- */
  R({ id: 'click_gap', goals: ['acquire', 'measure'], pri: 3,
    when: function (c) { var e = c.any('q9', ['clicks_no_visits']); return e.length ? e : null; },
    area: function () { return 'the gap between reported clicks and visits that actually arrive'; },
    link: function () { return 'When lots of clicks never turn into visits, it’s usually slow pages, broken tracking or junk clicks, and it’s worth ruling those out before you blame the audience.'; },
    impact: function () { return 'Clicks that never become visits make your ads look cheaper than they really are, and they hide where people are actually dropping off.'; },
    why: function () { return [E('Slow loading, especially on phones, may lose people before the page appears.', 'Test your landing page on a phone with a free speed tool, and compare clicks with visits by device. If phones lose more people and the page is slow, speed is the issue.', ['speed', 'website']),
      E('Some clicks may be accidental or low quality, or your analytics tag may not fire on every page.', 'Compare clicks with visits by placement, and check your analytics tag is on every landing page. If the gap is mostly on one placement, those clicks are low quality. If it’s everywhere, your tracking is probably broken.', ['tracking', 'targeting'])]; },
    check: function () { return 'Compare ad-reported clicks with analytics sessions from the same campaigns and dates, and test your landing page speed on a phone.'; },
    action: function () { return 'Put ad-platform clicks next to analytics sessions for the same campaigns over the same two weeks. A consistent gap on one placement or device tells you whether to fix page speed, tracking or placements first.'; },
    confirm: function () { return 'Campaign clicks compared with analytics sessions'; },
    record: function () { return 'Campaign click reports next to analytics sessions for the same dates'; } });

  /* ---- Measurement ---- */
  var GOOD_MEASURE = ['to_completed', 'revenue', 'consumer_sales', 'direct_source', 'signed', 'to_retained', 'to_paid', 'to_completion', 'attended', 'repeat', 'profitable'];
  R({ id: 'measurement', goals: ['measure', 'unclear', 'cost'], pri: 1,
    when: function (c) {
      var e = [];
      e = e.concat(c.any('q11', ['none', 'reach']));
      if (c.is('q11', 'reach') && c.linked) e = e.filter(function (x) { return x.code !== 'reach'; });
      e = e.concat(c.any('q10', ['cant_tell', 'not_sure']));
      if (c.is('q11', 'compare') && !c.linked) e = e.concat(c.any('q11', ['compare'], 0.5));
      e = e.concat(c.any('q9', ['likes_only']));
      if (c.is('q7', 'unknown')) e.push(c.ev('q7'));
      if (c.goal === 'measure' || c.goal === 'unclear') { var v9 = c.ev('q9'); if (v9 && GOOD_MEASURE.indexOf(v9.code) < 0 && ['na', 'other'].indexOf(v9.code) < 0) e.push(v9); }
      e = e.concat(c.any('q9', ['unknown_cpo', 'unknown_cv', 'cant_track', 'to_clicks', 'to_signup', 'not_measured', 'unclear_incremental', 'engage_unknown', 'cant_tell', 'retailer_orders', 'retailer_only', 'not_tracked']).filter(function (x) { return !e.some(function (y) { return y.q === x.q; }); }));
      if (c.is('q6', 'new')) e.push(c.ev('q6', 'new', 0.5));
      if (c.is('q6', 'retailer_only')) e.push(c.ev('q6', 'retailer_only'));
      return e.length ? e : null; },
    area: function (c) { return 'how you connect your marketing to ' + c.o; },
    link: function (c) { return 'Until you can connect your marketing to ' + c.o + ', you can’t really tell whether you have too few people coming in or too few of them buying.'; },
    impact: function (c) { return 'Without that link, you can’t tell which spending brings in ' + c.o + ' and which just keeps people busy.'; },
    why: function (c) {
      if (c.is('q9', 'overlap', 'disagree')) return [E('Several platforms may each be claiming the same sale.', 'Add up the sales each platform claims for one week and compare with your actual orders. If their total is well above your real orders, they’re double counting.', ['tracking']),
        E('Their attribution windows and definitions may differ, so the totals may not match.', 'Note each platform’s attribution window and what it counts as a conversion. Different settings explain at least part of the mismatch.', ['tracking'])];
      if (c.b === 'I') return [E('Retailer orders may be standing in for shopper purchases, which move on a different timeline.', 'Ask your main retailer for sell-through data for one campaign period and compare it with your orders. If they move differently, retailer orders are a misleading guide.', ['tracking']),
        E('Campaign areas and stocked stores may not be compared directly.', 'Map campaign areas against stores that stock the product. If they rarely overlap, results cannot be judged yet.', ['tracking', 'stockists'])];
      return [E('Tracking may stop at clicks, enquiries or engagement, so later outcomes are not tied to a source.', 'Take ten recent ' + c.o + ' and try to trace each one to its source. If you can’t trace most of them, that’s the gap to close first.', ['tracking']),
        E('The records exist but may sit in separate systems that are not compared.', 'List where source, enquiry and sale information is kept. If it all sits in separate places with nothing tying it together, that’s why you can’t see it.', ['tracking'])]; },
    check: function (c) { return {
      A: 'Pick one recent week and match completed orders to their source using your order records, not ad-platform reports alone.',
      B: 'Choose one outcome that matters, such as a first useful action or a paid conversion, and check whether you can see the source for each new user who reached it.',
      C: 'For two weeks, record how each customer found you, using a question at the counter or a code, alongside each order or booking.',
      D: 'For two weeks, ask shoppers at the till how they heard about you, or use a simple code, and record it with the sale.',
      E: 'Take enquiries from at least three months ago and trace how far each one got, grouped by source.',
      F: 'Take enquiries from the last six months and record which became meetings, proposals and signed work, grouped by source.',
      G: 'For one month, record the source of each booking and whether the person attended.',
      H: 'Take your last intake’s enquiries and trace each one to trial, enrolment and attendance, grouped by source.',
      I: 'Line up campaign areas and dates with shopper sales by store where you can get them, rather than retailer orders.' }[c.b]; },
    action: function (c) { return this.check(c) + (c.is('q5', 'creators', 'partners', 'referrals', 'offline', 'events', 'pr', 'sampling') ? ' Give creators, partners or offline activity their own codes or links, since they rarely show up in platform reports.' : '') + ' Then you’ll know which sources actually bring in ' + c.o + ' before you decide where to spend more.'; },
    confirm: function (c) { return 'Records that link each ' + SINGLE[c.b] + ' to where it came from'; },
    record: function (c) { return { A: 'A campaign report alongside completed orders for the same period', B: 'Signup, activation and payment records with their acquisition source',
      C: 'Order or booking records with how each customer found you', D: 'Till records with a source question or code', E: 'Enquiry records traced to viewings and completed transactions',
      F: 'CRM or enquiry records traced to meetings, proposals and signed work', G: 'Booking records with source and attendance', H: 'Trial attendance and enrolment records by source',
      I: 'Retailer sales and stock availability by store, next to campaign areas' }[c.b]; } });

  /* ---- Promotion dependence ---- */
  R({ id: 'promo_dep', goals: ['promo', 'cost', 'retain'], pri: 2,
    when: function (c) {
      var e = c.any('q6', ['promo']).concat(c.any('q9', ['discounted_only', 'discounts', 'promo_return', 'discount_return', 'discount_loyalty', 'discount_buy', 'rise_fall', 'after_promo', 'existing_only']));
      if (c.b === 'D') e = e.concat(c.any('q7', ['discount_only']));
      return e.length ? e : null; },
    area: function (c) { return 'how much of your demand depends on promotions'; },
    link: function () { return 'It looks like your promotions may be doing more of the selling than your regular offer.'; },
    impact: function (c) { return 'If most ' + c.o + ' only come with a discount attached, the numbers can look healthy while each sale quietly earns you less.'; },
    why: function () { return [E('Customers may have learned to wait for offers, so promotions bring forward sales that would have happened anyway.', 'Compare sales in the weeks just before and after each promotion with normal weeks. If sales dip just before and after, people are waiting for the deal.', ['promo']),
      E('The value of your regular offer may be less clear than it needs to be without a discount attached.', 'Compare how your full-price marketing describes the offer with what customers say they value. If it’s mostly about price, that’s probably why people wait for a discount.', ['creative', 'pricing'])]; },
    check: function () { return 'Compare how many customers bought at full price with how many bought only on promotion over the last three months.'; },
    action: function () { return 'Split last quarter’s sales into promotion and non-promotion periods using your sales or order records, and compare what each earned after discounts and fees. This helps you decide whether promotions add new customers or mostly move existing ones.'; },
    confirm: function () { return 'Sales split by promotion and full-price periods'; },
    record: function () { return 'Sales split by promotion and full-price periods, with discount and fee costs'; } });

  /* ---- Promotion return after costs / timing ---- */
  R({ id: 'promo_margin', goals: ['promo', 'cost'], pri: 3,
    when: function (c) {
      var e = c.any('q9', ['low_margin', 'when_full', 'margin_falls', 'contribution_unclear', 'discount_margin', 'returns']);
      if (!e.length && !c.is('q6', 'profit_flat')) return null;
      e = e.concat(c.any('q6', ['profit_flat']));
      if (c.b === 'C' && c.is('q9', 'when_full', 'low_margin')) e = e.concat(c.any('q8', ['peak_full']));
      return e; },
    promo: function (c) { return c.is('q9', 'low_margin', 'when_full', 'margin_falls', 'contribution_unclear', 'discount_margin'); },
    area: function (c) { if (!this.promo(c)) return 'whether your extra ' + c.o + ' are adding profit'; return c.b === 'C' && c.is('q9', 'when_full') ? 'when your promotions run compared with your busy periods' : 'what your promotions and extra sales earn after costs'; },
    link: function () { return 'When sales go up and profit doesn’t, it’s usually discounts, fees, timing or what people are buying. Your answers don’t tell us which one yet.'; },
    impact: function (c) { return 'Extra ' + c.o + ' are only worth having if there’s still profit left after discounts, fees and delivery.'; },
    why: function (c) { if (!this.promo(c)) return [E('Newer customers or orders may be lower in value, or cost more to serve, than earlier ones.', 'Compare average order value and cost to serve for new customers with earlier ones. If newer customers spend less or cost more to serve, that’s where the margin is going.', ['targeting', 'pricing']),
        E('Discounts, fees, returns or delivery costs may be rising alongside volume.', 'Put discounts, fees, returns and delivery costs as a share of sales for this quarter next to last quarter. If that share is climbing, it’s eating the growth.', ['promo', 'delivery'])];
      return c.b === 'C' ? [E('Promotions may run when you are already busy, discounting orders you would have had anyway.', 'Compare promotion orders in busy and quiet periods. Many promotion orders at peak times support this.', ['promo']),
        E('Platform commission, delivery costs and the discount together may leave little from each extra order.', 'Work out what one typical promotion order earns after commission, delivery and discount. If it’s tiny or negative, the promotions aren’t paying for themselves.', ['promo', 'pricing'])] :
      [E('Discounts, platform or trade fees and returns together may absorb most of the extra revenue.', 'For your last promotion, subtract discounts, fees and returns from the extra revenue it brought. If there’s little left, the promotion isn’t paying for itself.', ['promo', 'pricing']),
        E('Growth may be coming from lower-value orders or customers.', 'Compare the average order value of new customers this quarter with last quarter. If it has clearly dropped, growth is coming from smaller orders.', ['targeting', 'pricing'])]; },
    check: function (c) { if (!this.promo(c)) return 'Compare the margin on ' + c.o + ' from the last three months with the three months before, after discounts, fees and returns.';
      return c.b === 'C' ? 'Compare promotion orders in busy and quiet periods, and review what each earned after discounts and platform fees.' : 'Review what each recent promotion or campaign earned after discounts, fees and returns, not just the sales it added.'; },
    action: function (c) { if (!this.promo(c)) return 'In your sales records, compare what each ' + SINGLE[c.b] + ' earned after discounts, fees and delivery this quarter and last quarter, split by channel. This tells you whether the drop comes from order value, costs or a particular channel.';
      return 'List your last three promotions with the extra ' + c.o + ', the discount given and any platform, trade or delivery costs, using your sales and platform statements. This shows which promotions are worth repeating and which only moved volume.'; },
    confirm: function (c) { return this.promo(c) ? 'Promotion results after discounts and fees' : 'Margin by period and channel'; },
    record: function (c) { return c.b === 'C' ? 'Promotion and platform statements split by busy and quiet periods' : 'Promotion results with discounts, fees and returns'; } });

  /* ---- Capacity, stock and availability (operating constraints) ---- */
  R({ id: 'capacity', goals: ['convert', 'acquire', 'demand', 'promo'], pri: 3,
    when: function (c) {
      var e = [];
      if (c.b === 'C') e = c.any('q8', ['waits', 'staffing', 'delivery_area']).concat(c.any('q9', ['availability', 'date_capacity']));
      if (c.b === 'D') e = c.any('q8', ['unavailable', 'stock_wrong', 'not_ready']).concat(c.any('q9', ['stock_out']));
      if (c.b === 'A') e = c.any('q8', ['stock']);
      if (c.b === 'I') e = c.any('q8', ['varies', 'oos']).concat(c.any('q7', ['no_stock'])).concat(c.any('q9', ['stock_out']));
      if (c.b === 'G') e = c.any('q8', ['no_slot']).concat(c.any('q9', ['few_slots']));
      if (c.b === 'H') e = c.any('q8', ['intake']).concat(c.any('q9', ['wait_start']));
      return e.length ? e : null; },
    area: function (c) { return { A: 'stock and product choice', C: 'your capacity at the times customers want to come or order', D: 'whether the products you promote are available to buy',
      G: 'appointment availability', H: 'the wait until the next start date', I: 'stock availability where your marketing runs' }[c.b]; },
    link: function () { return 'From what you’ve told us, this looks more like an availability problem than a lack of interest, though it’s worth checking.'; },
    impact: function (c) { return 'Marketing can’t turn interest into ' + c.o + ' if there’s nothing available when people are ready, and more marketing may just mean more disappointed people.'; },
    why: function (c) { return {
      A: [E('Popular sizes or variants may sell out faster than you restock.', 'Check stock-out dates for your most-promoted products against your campaign dates. Overlaps support this.', ['capacity']),
        E('Your range may not match what the people you reach are looking for.', 'List the items shoppers ask for that you do not carry. Frequent requests support this.', ['targeting', 'capacity'])],
      C: [E('Staffing or kitchen capacity may cap how many orders you can take at peak times.', 'Compare orders and waiting times by hour with the staff on shift. Long waits when fully staffed support this.', ['capacity']),
        E('Delivery radius or platform coverage may exclude people your marketing reaches.', 'Compare your delivery area with where your marketing reaches. If they don’t overlap much, you’re paying to reach people you can’t deliver to.', ['targeting', 'delivery'])],
      D: [E('Stock of promoted items may not be reaching the store in time.', 'Check when promoted items arrived in store against your campaign start dates. Late arrivals support this.', ['capacity']),
        E('Stock records may not match what is actually on the shelf.', 'Spot-check the shelves for five promoted items against your stock system. Mismatches support this.', ['capacity'])],
      G: [E('Practitioner hours may not match when clients want appointments.', 'Compare the times people ask for with the times slots are open. Many requests for unavailable times support this.', ['capacity']),
        E('Slots may be held for existing clients, leaving little for new enquiries.', 'Check how many slots in the next two weeks are open to new clients. If there are hardly any, new clients simply can’t get in.', ['capacity'])],
      H: [E('Intakes may be too far apart for people who want to start now.', 'Count people who wanted to start sooner than the next intake, and how many enrolled when it came. If many didn’t, the wait is costing you.', ['capacity']),
        E('There may be no interim option, such as a trial or waitlist class, to hold interest.', 'Check what people waiting for an intake hear from you. If they hear nothing until the start date, that gap is where you lose them.', ['retention', 'response'])],
      I: [E('Retailer coverage may be patchy in the areas you advertise.', 'Map stocked stores against your campaign areas. Gaps support this.', ['stockists']),
        E('Stock may sell out or not be replenished during campaigns.', 'Ask retailers for stock levels during your last campaign. Stock-outs support this.', ['capacity', 'stockists'])] }[c.b]; },
    check: function (c) { return { A: 'Compare lost-sale feedback with your stock records for the products you promote most.', C: 'Compare demand by hour or day with the capacity and staff you had at those times.',
      D: 'Check whether the products in your last campaign were in stock in-store for its full duration.', G: 'Compare when enquiries arrive with when suitable slots are actually open.',
      H: 'Count how many interested people were waiting for a start date and how many enrolled when it came.', I: 'Check stock in stores near where your campaigns ran, during the campaign period.' }[c.b]; },
    action: function (c) { return this.check(c) + ' If availability is what’s holding you back, fix that before adding marketing. Some of it may be more of an operations call than a marketing one.'; },
    confirm: function (c) { return c.b === 'G' ? 'Your booking calendar and enquiry times' : c.b === 'H' ? 'Your waitlist and intake records' : 'Stock or capacity records'; },
    record: function (c) { return { A: 'Stock-out history for promoted products', C: 'Orders and capacity by hour or day', D: 'Store stock records for promoted products', G: 'Slot availability next to enquiry times',
      H: 'Intake dates, waitlists and enrolment timing', I: 'Retailer sales and stock availability by store' }[c.b]; } });

  /* ---- Consumer brand: where to buy ---- */
  R({ id: 'where_to_buy', goals: ['convert', 'demand'], pri: 4,
    when: function (c) { if (c.b !== 'I') return null;
      var e = c.any('q7', ['where_to_buy']).concat(c.any('q9', ['where'])).concat(c.any('q8', ['no_distribution', 'no_visibility']));
      if (!c.is('q7', 'where_to_buy') && !c.is('q9', 'where')) return null;
      return e; },
    area: function () { return 'whether interested shoppers can find where to buy'; },
    link: function () { return 'If people can’t find it on a shelf, they can’t buy it, however good the marketing is.'; },
    impact: function (c) { return 'Every interested shopper who can’t find the product is demand you may have paid for and then lost.'; },
    why: function () { return [E('Your marketing may run in areas where few stores carry the product.', 'Map stockists against the areas your campaigns target. Large uncovered areas support this.', ['stockists', 'targeting']),
      E('Stockist information may be hard to find in your ads, social pages or packaging.', 'Look at your ads and profiles as a shopper would and see how quickly you can find where to buy. If it takes more than a few seconds, people are giving up.', ['stockists', 'creative'])]; },
    check: function () { return 'Make sure your campaigns run where the product is actually stocked, and that people can see where to buy it from your ads and profiles.'; },
    action: function () { return 'Map your stockists against the areas your campaigns target. Where there are gaps, either pull the campaigns back to covered areas or make the nearest stockist easy to find, before you spend more.'; },
    confirm: function () { return 'Stockist coverage compared with campaign areas'; },
    record: function () { return 'Stockist lists by area next to campaign targeting'; } });

  /* ---- Message clarity before enquiry ---- */
  R({ id: 'message', goals: ['acquire', 'demand', 'convert'], pri: 2,
    when: function (c) {
      var e = c.any('q9', ['missing_info', 'lifestyle', 'inconsistent', 'broad', 'not_distinct', 'how_use', 'difference', 'wrong_expect', 'expectations', 'cant_see', 'price_pack', 'details', 'capabilities', 'price_offer']);
      if (c.b === 'C') e = e.concat(c.any('q9', ['delivery_fees', 'dietary', 'price']));
      e = e.filter(function (x) { return !(x.code === 'inconsistent' && c.b !== 'E'); });   // elsewhere it describes the experience, not the message
      if (c.b === 'G') e = e.concat(c.any('q8', ['uncertainty', 'assessment']));
      if (c.b === 'E' && c.is('q8', 'budget', 'location_type')) e = e.concat(c.any('q8', ['budget', 'location_type']));
      return e.length ? e : null; },
    area: function (c) { return { E: 'what your listings make clear before someone enquires', F: 'how specifically your marketing explains who you help and the results you get',
      I: 'whether shoppers understand when and why to choose your product', B: 'what people expect before they sign up', G: 'what people expect before they enquire', C: 'what people can see about your menu, prices and delivery terms before they order' }[c.b] || 'what your marketing makes clear before someone gets in touch'; },
    link: function () { return 'When your message leaves gaps, people fill them in themselves, and what they imagine may not be what you actually offer.'; },
    impact: function (c) { return 'An unclear message pulls in people who drop out later, and you pay for every one of them.'; },
    why: function (c) {
      if (c.b === 'E') return [E('Listings may leave out price range, location or key details, so budget or location mismatches only surface after the enquiry.', 'Check your top listings for price range, location and key details, then note how many recent enquiries dropped out over those points. Many such drop-outs support this.', ['pages', 'creative']),
        E('Lifestyle or investment messaging may draw interest from people outside your buyer profile.', 'Compare enquiries from lifestyle-led ads with enquiries from detail-led ads. More budget or location mismatches from the lifestyle ads support this.', ['creative', 'targeting'])];
      if (c.b === 'F') return [E('Broad claims may make you sound like many other providers, so enquiries arrive without a reason to choose you.', 'Put your main page next to two competitors’ pages and ask whether a stranger could tell you apart. If they couldn’t, your message is too generic.', ['creative', 'website']),
        E('Evidence of results for a specific type of client may be missing.', 'Check whether your marketing shows a result for a client like your target buyer. If there isn’t one, buyers have nothing to go on.', ['proof'])];
      if (c.b === 'I') return [E('The product’s use or occasion may not be obvious from the pack or ads.', 'Ask five people who do not know the product what it is for after seeing the pack or an ad. Mixed answers support this.', ['creative', 'pages']),
        E('Shoppers may not see a clear difference from alternatives on the shelf.', 'Photograph your product next to its shelf neighbours and note what makes it different at a glance. If nothing jumps out, shoppers won’t see a reason to pick yours.', ['pages', 'creative'])];
      return [E('Your marketing may promise or imply something the product or service does not deliver.', 'Note what people who dropped out expected, and compare it with what your main ads say. Repeated gaps support this.', ['creative']),
        E('Key details people need to decide may only appear after they get in touch.', 'List the questions people ask in their first message. If your ads and pages don’t answer them, people are enquiring just to find out the basics.', ['website', 'pages', 'creative'])]; },
    check: function (c) { return c.b === 'E' ? 'Check your listings are clear on price and location, then see which source brings in the most enquiries that actually fit the budget.' :
      'Put your three main ads or pages side by side and check whether each states who it is for, what it does and what it costs or requires.'; },
    action: function (c) { return 'Go through the last 20 people who dropped out after first contact and note what they expected that you don’t offer. Then put that next to what your main ads or listings say, and you’ll see which detail to make clearer first.'; },
    confirm: function () { return 'Notes on why early enquiries dropped out'; },
    record: function () { return 'Reasons early enquiries dropped out, next to the ads or listings they came from'; } });

  /* ---- Enquiry qualification ---- */
  R({ id: 'qualification', goals: ['acquire', 'cost', 'meetings', 'viewings'], pri: 3,
    when: function (c) {
      var e = [];
      if (c.b === 'E') e = c.any('q8', ['budget', 'location_type', 'later', 'junk']).concat(c.any('q9', ['all_equal', 'no_def', 'responded_def']));
      if (c.b === 'F') e = c.any('q8', ['diff_service', 'low_budget', 'no_authority', 'free_advice']).concat(c.any('q9', ['effort_per', 'small_contracts']));
      if (c.b === 'G') e = c.any('q9', ['wrong_service', 'outside_area']);
      if (c.b === 'H') e = c.any('q9', ['diff_level', 'cant_attend', 'not_decider']);
      if (c.b === 'B') e = c.any('q9', ['mismatch']).concat(c.any('q7', ['qualification']));
      return e.length ? e : null; },
    area: function (c) { return 'how well your enquiries match what you offer'; },
    link: function () { return 'When a lot of enquiries don’t fit, it usually means you’re doing the filtering after people get in touch, when it could happen before.'; },
    impact: function (c) { return 'Enquiries that don’t fit still eat up follow-up time, so each of your ' + c.o + ' ends up costing more, even when the enquiry numbers look fine.'; },
    why: function (c) {
      if (c.b === 'H' && c.is('q9', 'not_decider')) return [E('Your marketing may reach learners, while parents, employers or other payers make the decision.', 'Note who made the payment decision for your last 20 enrolments and who first enquired. If it’s often someone else paying, your marketing is talking to the wrong person.', ['targeting', 'creative']),
        E('The information the payer needs, such as outcomes and fees, may be harder to find.', 'Check whether fees, schedule and outcomes are on the pages payers see. If they’re missing or buried, the payer has nothing to say yes to.', ['website', 'qualify'])];
      return [E('Targeting or listings may not filter by budget, location, need or timing before someone enquires.', 'Mark your last 30 enquiries as good or poor fit and note why. If most poor fits fail for the same reason, that’s what to filter for upfront.', ['qualify', 'targeting']),
        E('Counting every enquiry equally may make channels that produce poor-fit enquiries look better than they are.', 'Count good-fit enquiries by source, instead of all enquiries. If the ranking of your channels changes, you’ve been judging them on the wrong number.', ['tracking'])]; },
    check: function (c) { return c.b === 'E' ? 'For each source, work out what you pay per enquiry that actually fits the budget, rather than per enquiry overall.' :
      'Mark your last 30 enquiries as good fit or poor fit using a simple definition, and compare the share by source.'; },
    action: function (c) { return 'Agree on a simple definition of a good enquiry (budget, need and timing confirmed, say), then go through last month’s enquiries and mark each one. Once you compare good enquiries by source, you’ll see which channels deserve more time or money.'; },
    confirm: function () { return 'Enquiries marked against a qualification definition'; },
    record: function () { return 'Lost-enquiry reasons and qualification notes by source'; } });

  /* ---- Response and follow-up after enquiry ---- */
  R({ id: 'response', goals: ['viewings', 'meetings', 'convert'], pri: 3,
    when: function (c) {
      var e = [];
      if (c.st7 === 'followup' && ['E', 'F', 'G', 'H', 'A'].indexOf(c.b) >= 0 && !c.is('q7', 'qualification')) e.push(c.ev('q7'));
      var fu = (c.goal === 'retain' || c.goal === 'renew') ? [] : ['no_followup'];   // after an enquiry, not after a purchase
      e = e.concat(c.any('q9', ['varies', 'auto_later', 'wait_reply', 'many_msgs', 'fu_varies', 'general_offer', 'response', 'unresponsive'].concat(fu)));
      if (c.b === 'G') e = e.concat(c.any('q8', ['slow_booking']));
      return e.length ? e : null; },
    area: function (c) { return { E: 'what happens in the first hours after someone enquires about a property', F: 'what happens between an enquiry and a first conversation',
      G: 'how quickly an enquiry turns into a confirmed booking', H: 'what happens after an enquiry or trial', A: 'how message enquiries are handled' }[c.b] || 'what happens after someone enquires'; },
    link: function () { return 'People who’ve already enquired can still slip away if the next step is slow or unclear.'; },
    impact: function (c) { return 'You’ve already paid for these enquiries, so anything lost here is money already spent with nothing to show for it.'; },
    why: function (c) { if (c.is('q9', 'unresponsive')) return [E('Prospects may have enquired early in their research and are not ready yet.', 'Note when unresponsive enquirers said they planned to decide, or ask a few. Long timelines support this.', ['qualify']),
        E('Follow-up messages may not give a reason to reply, such as a specific viewing slot or answer to their question.', 'Read your last ten follow-up messages. If they don’t offer a clear next step, people have no reason to reply.', ['response'])];
      return [E('Response times may vary with staff availability, so some enquiries go cold before anyone replies.', 'Note how long your last 30 enquiries waited for a personal reply, and how many of the quick and slow ones went anywhere. If the slow ones go cold more often, speed is costing you clients.', ['response']),
        E('The next step may be unclear or take several messages to arrange.', 'Count how many messages it took to arrange the next step for your last ten enquiries. If it takes a lot of back-and-forth, the process itself is losing people.', ['response', 'reminders'])]; },
    check: function (c) { return 'For your last 30 enquiries, note how long it took someone to reply personally, and compare how many of the quick and slow ones went anywhere.'; },
    action: function (c) { return 'Pull your last 30 enquiries from your inbox, WhatsApp or CRM, and note how quickly each got a reply and whether it went anywhere. If the slow replies go cold noticeably more often, speed up your replies before you pay for more enquiries.'; },
    confirm: function () { return 'Enquiry response times and outcomes'; },
    record: function () { return 'Enquiry timestamps, first-response times and what happened next'; } });

  /* ---- Attendance of booked steps ---- */
  R({ id: 'attendance', goals: ['noshow', 'viewings', 'meetings', 'convert', 'attend'], pri: 3,
    when: function (c) {
      var e = [];
      if (c.st7 === 'attend') e.push(c.ev('q7'));
      e = e.concat(c.any('q9', ['forget', 'reschedule_hard', 'long_wait', 'expectations_unclear', 'no_show']));
      if (c.goal === 'noshow' && c.is('q9', 'uncommon')) return null;
      return e.length ? e : null; },
    noun: function (c) { return { E: 'viewings', F: 'meetings', G: 'appointments', H: 'trials or consultations', C: c.sub === 'catering' ? 'catering bookings' : 'reservations', B: 'demos', D: 'click-and-collect orders' }[c.b] || 'bookings'; },
    area: function (c) { return 'how many booked ' + this.noun(c) + ' actually go ahead'; },
    link: function () { return 'A booking shows interest, but it only counts once the person actually turns up.'; },
    impact: function (c) { return 'Every booking that doesn’t go ahead is something you paid to get, and counting bookings alone can make your marketing look better than it is.'; },
    why: function (c) { if (c.b === 'D') return [E('Orders may not be ready or may not be confirmed clearly, so people do not come.', 'Check how many uncollected orders received a clear ready-for-pickup message on time. If many didn’t get one, that’s probably why they aren’t coming in.', ['checkout', 'reminders']),
        E('Pickup times or location may be inconvenient.', 'Ask a few customers who did not collect why. Timing or location reasons support this.', ['capacity'])];
      return [E('Reminders or confirmations may be missing, late or unclear about time and location.', 'Compare attendance for bookings that received a clear reminder with those that did not. If reminded bookings turn up more often, the fix is making sure everyone gets one.', ['reminders']),
        E('A long gap between booking and the date may let interest fade or plans change.', 'Compare attendance for bookings made within a few days with those made further ahead. If far-off bookings no-show more, the wait is the problem.', ['capacity', 'reminders'])]; },
    check: function (c) { return 'Compare attendance for ' + this.noun(c) + ' booked within a few days with those booked further ahead, and check what reminder each received.'; },
    action: function (c) { return 'Using your booking records for the last two months, compare bookings with what actually went ahead, split by how far ahead they were booked and whether a reminder was sent. This tells you whether timing or reminders deserve attention first.'; },
    confirm: function () { return 'Booking and attendance records'; },
    record: function (c) { return 'Booking and attendance records for ' + this.noun(c); } });

  /* ---- Value proof before commitment ---- */
  R({ id: 'value_proof', goals: ['close', 'convert'], pri: 3,
    when: function (c) {
      var e = [];
      if (['F', 'E', 'H', 'B'].indexOf(c.b) >= 0 && (c.st7 === 'close' || c.is('q7', 'before_pay', 'evaluation'))) e.push(c.ev('q7'));
      e = e.concat(c.any('q9', ['roi', 'proof', 'scope', 'competitor', 'needs_fit', 'other_property', 'decision_maker', 'free_enough', 'clear_rec', 'missing_feature']).concat(c.b === 'B' ? c.any('q9', ['price']) : []));
      if (c.b === 'H') e = e.concat(c.any('q8', ['fees', 'outcomes', 'level', 'payer']));
      if (c.b === 'F') e = e.concat(c.any('q8', ['fit'], 0.5));
      if (c.is('q9', 'clear_rec') && e.length < 2) return null;
      e = e.filter(function (x) { return x.code !== 'clear_rec'; });
      return e.length ? e : null; },
    area: function (c) { return { F: 'how your proposals connect your work to the client’s goal', E: 'why viewings or proposals do not become agreements',
      H: 'what happens between a trial or consultation and a paid enrolment', B: 'what users see before they are asked to pay' }[c.b] || 'what helps people commit'; },
    link: function (c) { return c.b === 'F' && c.is('q8', 'fit') ? 'Your enquiries seem to fit, so the gap may be in how you show your value, more than who you attract.' : 'These people are close to deciding, so the question is what they still need before they feel sure enough to say yes.'; },
    impact: function (c) { return 'You’ve put real time and money into getting these people this far, so each one you lose here hurts more than one lost earlier.'; },
    why: function (c) {
      if (c.b === 'B') return [E('Users may not reach the part of the product that shows its value before the paywall or trial ends.', 'Check what share of users who reach the paywall or trial end have completed your key value action. If most haven’t, they’re hitting the paywall before they see the value.', ['onboarding']),
        E('The difference between free and paid may be unclear, or the free version may already meet their need.', 'Compare how free users who never upgrade use the product with those who do. If non-upgraders use it fully, the free plan may already be enough.', ['pricing'])];
      if (c.b === 'E') return [E('The property, price or financing may not fit the buyer’s situation once they see it in person.', 'Record the stated reason for each lost prospect after a viewing for a month. Price, fit or financing reasons support this.', ['qualify', 'pages']),
        E('Co-buyers or decision-makers may not have been involved early enough.', 'Check how many lost prospects viewed without their co-buyer or decision-maker. If most did, you need the decision-maker involved earlier.', ['qualify', 'proposals'])];
      if (c.b === 'H') return [E('The recommendation after a trial may be general rather than tied to the person’s goal and level.', 'Compare enrolment for people who received a specific recommendation after their trial with those who received a general offer. If specific ones convert better, make every recommendation specific.', ['proposals']),
        E('The payer may not have enough information on outcomes, schedule or fees to agree.', 'Ask a few people who did not enrol whether the payer had the details they needed. Missing details support this.', ['proposals', 'website'])];
      return [E('Proposals may describe the work without connecting it to the buyer’s goal or expected return.', 'Compare won and lost proposals from the last six months. If the ones you won talk about the client’s business result and the lost ones don’t, that’s the difference.', ['proposals']),
        E('The buyer may lack proof from similar clients to feel confident.', 'Check whether lost prospects saw a relevant example or case study. If they rarely did, they had nothing to reassure them.', ['proof'])]; },
    check: function (c) { return c.b === 'F' ? 'Compare won and lost proposals from the last six months and check whether the won ones connected scope to a specific business result.' :
      c.b === 'H' ? 'Compare enrolment rates for people who received a specific recommendation after their trial with those who received a general offer.' :
      c.b === 'B' ? 'Check what share of users who reach your paywall or trial end have completed the action that best shows the product’s value.' :
      'Record the stated reason for every lost prospect after a viewing or proposal for the next month.'; },
    action: function (c) { return this.check(c) + ' That tells you whether people aren’t seeing the value or whether it’s really about fit or price. And price objections on their own aren’t a good reason to discount.'; },
    confirm: function () { return 'Won and lost reasons'; },
    record: function (c) { return c.b === 'H' ? 'Trial attendance, follow-up notes and enrolment records' : c.b === 'B' ? 'Product usage before paywall or trial end, by converted and non-converted users' : 'Won and lost proposal or deal notes with stated reasons'; } });

  /* ---- Post-agreement delays (operational) ---- */
  R({ id: 'post', goals: ['close'], pri: 1,
    when: function (c) { var e = c.any('q7', ['finance', 'procurement']).concat(c.any('q9', ['paperwork', 'price_finance', 'approval']));
      return e.length ? e : null; },
    area: function (c) { return c.b === 'E' ? 'delays during finance, checks or documentation' : 'delays during approval or procurement'; },
    link: function () { return 'Delays this late are often about process and timing as much as marketing.'; },
    impact: function (c) { return 'Deals that stall late can make your marketing look worse than it is, because the ' + c.o + ' show up months after the enquiry.'; },
    why: function (c) { return c.b === 'E' ? [E('Buyers may reach reservation before their financing is confirmed.', 'Check at what stage financing was confirmed for reservations that fell through. If it was confirmed late or not at all, financing is where deals fall over.', ['qualify']),
        E('Documentation steps may be slow or unclear to buyers.', 'Time each documentation step for recent deals. If one step drags far longer than the rest, start there.', ['proposals', 'response'])] :
      [E('Buyers may not have budget approval or the right decision-makers involved.', 'Check when budget and decision-makers were confirmed on stalled deals. If they were confirmed late, deals are stalling because the buyer wasn’t ready.', ['qualify', 'proposals']),
        E('Procurement requirements may only surface late in the process.', 'List when procurement steps first came up on recent deals. If they only came up after the proposal, that’s what’s stalling things.', ['proposals'])]; },
    check: function (c) { return c.b === 'E' ? 'Check at what point financing readiness is confirmed, and how many reservations fall through afterwards.' : 'Check at what stage you confirm budget, decision-makers and procurement steps.'; },
    action: function (c) { return this.check(c) + ' Tweaking your targeting probably won’t fix this stage, so judge your marketing on earlier results while you sort out the process.'; },
    confirm: function () { return 'Stage-by-stage deal records'; },
    record: function (c) { return c.b === 'E' ? 'Reservations and what happened to each through finance and completion' : 'Deal stages with dates and reasons for delay'; } });

  /* ---- SaaS activation ---- */
  R({ id: 'activation', goals: ['convert', 'retain', 'acquire'], pri: 4,
    when: function (c) {
      var e = [];
      if (c.b === 'B') { e = c.any('q7', ['before_setup', 'before_useful']).concat(c.any('q8', ['logins', 'setup', 'feedback_only', 'undefined'], 0.5))
        .concat(c.any('q9', ['match_no_start', 'effort', 'never_value'])); if (!c.is('q7', 'before_setup', 'before_useful') && !c.is('q9', 'match_no_start', 'effort', 'never_value')) return null; }
      if (c.b === 'H' && c.sub === 'self_paced') e = c.any('q7', ['course_start']);
      return e.length ? e : null; },
    area: function (c) { return c.b === 'H' ? 'whether buyers start the course' : 'whether new users reach a useful first outcome'; },
    link: function () { return 'People are signing up, so the gap may be between signing up and the first moment the product actually helps them.'; },
    impact: function (c) { return 'People who never get to that moment are much less likely to become ' + c.o + ', so more signups won’t help much until this part works.'; },
    why: function () { return [E('Setup may ask for too much effort or information before anything useful happens.', 'Count the steps between signup and the first useful outcome, and see where users stop. If lots of people stop at one setup step, that step is the problem.', ['onboarding']),
      E('The useful first outcome may not be defined, so onboarding is not designed around reaching it.', 'Check whether your team can name one early action that predicts paying or staying. If nobody can, onboarding has nothing to aim at.', ['onboarding', 'tracking'])]; },
    check: function (c) { return c.is('q8', 'undefined', 'logins', 'setup', 'feedback_only') ? 'Define one useful outcome a new user should reach, then compare how often users from each channel reach it.' : 'Compare how often users from each channel reach your useful first outcome in their first week.'; },
    action: function (c) { return 'Define one useful first outcome (not a login) and measure what share of last month’s new users reached it, by acquisition channel, in your product analytics. This tells you whether to fix onboarding or change who you acquire before adding more installs.'; },
    confirm: function () { return 'Product analytics on the first useful action'; },
    record: function () { return 'Signup-to-first-useful-action data by acquisition source'; } });

  /* ---- Retention and churn ---- */
  var NATURAL = ['need_ended', 'independent', 'new_need', 'one_off', 'tourists', 'long_cycle', 'rarely_repurchased'];
  R({ id: 'retention', goals: ['retain', 'renew', 'attend'], pri: 2,
    when: function (c) {
      if (c.is('q9', 'many_return')) return null;
      var e = [];
      if (c.st7 === 'retain' || c.st7 === 'attendance') e.push(c.ev('q7'));
      e = e.concat(c.any('q9', ['no_habit', 'price_func', 'few_return', 'inconsistent', 'experience', 'low_repeat', 'results', 'no_renew', 'no_progress', 'promise_gap', 'level', 'schedule', 'access', 'buy_once']).concat(c.goal === 'renew' ? c.any('q9', ['price']) : []));
      if (!e.length) return null;
      if (c.is('q9', NATURAL[0], NATURAL[1], NATURAL[2], NATURAL[3], NATURAL[4], NATURAL[5], NATURAL[6])) e.push(c.ev('q9', null, 0.5));
      return e; },
    area: function (c) { return { B: 'why users stop using the product', F: 'why clients do not renew', H: c.goal === 'attend' ? 'why people stop attending' : 'what keeps people participating',
      I: 'why shoppers do not buy again', A: 'why customers do not buy again', C: 'why customers do not come back', G: 'the experience after a first visit', D: 'why shoppers do not return' }[c.b] || 'why customers do not return'; },
    link: function (c) { return c.b === 'H' ? 'Dropping out partway is different from finishing, which is a good result in itself.' : 'What happens after the first purchase or visit may matter more here than how you found these people.'; },
    impact: function (c) { return 'When customers leave early, you keep paying to replace them, and growth gets more expensive every month.'; },
    why: function (c) { if (c.b === 'B') return [E('Users may try the product without building it into a regular routine.', 'Compare how often retained and churned users used the product in their first month. If the people who left barely used it early on, the habit never formed.', ['onboarding', 'retention']),
        E('Price, missing features or reliability may outweigh the value they get.', 'Read cancellation reasons from the last three months. Price, feature or reliability reasons support this.', ['pricing'])];
      if (c.b === 'H') return [E('Schedules, level or workload may not suit people once they start.', 'Ask people who stopped what made it hard to continue. Schedule or level reasons support this.', ['capacity']),
        E('People may not see their progress, so the value is less visible over time.', 'Check whether members receive any progress update. If they don’t, and people who left say they didn’t see results, that’s likely why.', ['retention'])];
      return [E('The experience or product may not consistently match what first brought people in.', 'Compare the first experience of customers who returned with those who did not. Worse first experiences among non-returners support this.', ['staff', 'pages', 'creative']),
        E('There may be no timely, relevant reason for customers to return.', 'Check what past customers hear from you after their first purchase or visit. If it’s little or generic, they have no reason to come back.', ['retention'])]; },
    check: function (c) { return c.b === 'B' ? 'Compare the first-month behaviour of users who stayed with those who left.' :
      'Compare a group of customers who returned with a group who did not, and note what differed in their first experience.'; },
    action: function (c) { return 'Take 20 customers who came back and 20 who did not from your customer or booking records and compare their first experience, product and timing. This shows whether to focus on the experience itself or on follow-up.'; },
    confirm: function () { return 'Records comparing customers who return with those who do not'; },
    record: function (c) { return c.b === 'B' ? 'Usage and cancellation data for retained and churned users' : 'Customer records showing who returned, when and after what'; } });

  /* ---- Follow-up and staying in touch ---- */
  R({ id: 'followup', goals: ['retain', 'renew'], pri: 2,
    when: function (c) { var e = c.any('q9', ((c.goal === 'retain' || c.goal === 'renew') ? ['no_followup'] : []).concat(['no_contact', 'general_offers', 'fu_inconsistent', 'intend_not_book', 'undefined']));
      if (c.b === 'G' && c.is('q7', 'after_first')) e.push(c.ev('q7'));
      if (c.b === 'H' && c.is('q9', 'undefined')) e = c.any('q9', ['undefined']);
      return e.length ? e : null; },
    area: function (c) { return c.b === 'H' ? 'what you suggest as a suitable next step after a programme' : c.b === 'G' ? 'how appropriate follow-up visits are arranged' : 'how you stay in touch with past customers'; },
    link: function () { return 'Without a good reason or a nudge at the right time, even happy customers often don’t come back.'; },
    impact: function (c) { return 'Every customer who doesn’t come back has to be replaced with a new one, and new ones cost more to win.'; },
    why: function (c) { if (c.b === 'G') return [E('Follow-up may depend on individual staff rather than a routine.', 'Compare how often a next visit was booked across practitioners. Big differences support this.', ['retention', 'staff']),
        E('People may intend to return but have no easy way to book the next visit at the right time.', 'Check whether clients are offered a next booking or a reminder when a return is due. If they aren’t, people mean to come back and simply forget.', ['reminders', 'retention'])];
      return [E('You may not be able to recognise or contact past customers.', 'Count how many of last quarter’s customers you have contact details for. If it’s a small share, you can’t bring most of them back.', ['retention', 'tracking']),
        E('Follow-ups may be general offers rather than tied to what the person bought or needs next.', 'Read your last few follow-up messages. If everyone gets the same message, it probably feels like spam.', ['retention'])]; },
    check: function (c) { return c.b === 'G' ? 'Of the clients who should have come back, check how many actually had their next visit booked.' :
      'Check how many past customers you can contact, and what share received a relevant follow-up after their first purchase.'; },
    action: function (c) { return c.b === 'G' ? 'For clients from the last three months who should have come back, check your booking system to see whether the next visit was booked before they left. That shows whether the gap is at the front desk or in the reminders afterwards.' :
      (c.is('q5', 'crm', 'lifecycle') ? 'You already use email, SMS or WhatsApp, so check what share of last quarter’s customers are on that list and what each one received after their first purchase. This tells you whether the gap is reaching past customers or what you send them.' : 'Count how many of last quarter’s customers you can recognise and contact through your order, booking or loyalty records, and how many heard from you after their first purchase. This tells you whether the gap is capturing contacts or using them.'); },
    confirm: function () { return 'Records of past customers and follow-ups sent'; },
    record: function () { return 'Past-customer contact records and follow-up history'; } });

  /* ---- Unit economics ---- */
  R({ id: 'unit_econ', goals: ['cost'], pri: 2,
    when: function (c) { var e = c.any('q9', ['low_aov', 'buy_once', 'small_contracts']);   // not knowing the figures is a measurement gap, not evidence of weak unit economics
      return e.length ? e : null; },
    area: function (c) { return 'what each ' + SINGLE[c.b] + ' costs to win compared with what it earns'; },
    link: function () { return 'Sometimes the cost problem is what each customer is worth to you, and only partly what it costs to reach them.'; },
    impact: function (c) { return 'If each ' + SINGLE[c.b] + ' earns less than it costs to win, more marketing just makes the hole deeper.'; },
    why: function (c) { return [E('Order or contract values may be too small to cover acquisition costs on the first purchase.', 'Compare cost per completed ' + SINGLE[c.b] + ' with the margin on a typical first purchase. If it costs more to win them than the first order makes, you’re losing money on every first sale.', ['pricing', 'promo']),
      E('Customers may not return often enough to recover the cost over time.', 'Check what share of customers from six months ago have bought again. If very few have, one purchase isn’t covering what it cost to win them.', ['retention'])]; },
    check: function (c) { return 'Work out cost per completed ' + SINGLE[c.b] + ' for your main channel, and compare it with the margin from a typical first purchase and any repeat purchases.'; },
    action: function (c) { return 'For last month, divide spend on your main channel by the completed ' + c.o + ' it produced, using order or sales records rather than platform-reported conversions. Comparing that with first-purchase margin shows whether to work on order value, repeat buying or acquisition cost.'; },
    confirm: function () { return 'Spend and completed-sale records by channel'; },
    record: function () { return 'Spend by channel next to completed sales and margin'; } });

  /* ---- Concentrated drop-off ---- */
  R({ id: 'concentrated', goals: ['convert'], pri: 2,
    when: function (c) { var e = c.any('q9', ['one_source', 'one_store', 'category', 'time', 'new_shoppers']);
      if (c.b === 'A') e = e.concat(c.any('q9', ['few_products']).filter(function () { return !c.is('q7', 'before_cart'); }));
      return e.length ? e : null; },
    area: function () { return 'the specific product, source, store or time where results drop'; },
    link: function () { return 'The good news is that a drop in one place is much easier to pin down than one spread across the whole business.'; },
    impact: function (c) { return 'Fixing that one weak spot could lift your overall ' + c.o + ' without touching anything else.'; },
    why: function () { return [E('Something specific to that product, source or location may differ, such as stock, staff, pricing or audience.', 'Put the weak area next to a strong one on stock, price, staff and audience for the same period. Whatever stands out most is your best lead.', []),
      E('The weak area may receive a different type of visitor with lower intent.', 'Compare where visitors to the weak and strong areas come from. Different sources support this.', ['targeting'])]; },
    check: function () { return 'Compare the weak area against a strong one on the same measures, over the same period.'; },
    action: function (c) { return 'In your sales or analytics reports, put the weak product, source or store next to your best one for the same month. Whatever difference jumps out first is where to dig.'; },
    confirm: function () { return 'Results split by product, source or location'; },
    record: function () { return 'Results split by the area where the drop concentrates'; } });

  /* ---- In-store conversion ---- */
  R({ id: 'store_conv', goals: ['convert'], pri: 3,
    when: function (c) { if (c.b !== 'D') return null;
      var e = c.any('q7', ['visit_no_buy', 'product_view']);
      if (!e.length) return null;
      return e.concat(c.any('q8', ['no_help', 'browsing', 'price', 'payment'])); },
    area: function () { return 'what happens when shoppers are in the store'; },
    link: function () { return 'People are coming in, so the gap may be somewhere between walking in and buying.'; },
    impact: function (c) { return 'The people who walk out empty-handed are the ones your marketing already brought in, so this is worth fixing before you chase more footfall.'; },
    why: function () { return [E('Shoppers may not get help at the moment they need it.', 'Have staff note the reason for visible walk-outs for two weeks. Frequent no-help reasons support this.', ['staff']),
      E('Prices or options may not match what they expected from your marketing.', 'Compare the prices and items in your recent ads with what is on the shelf. Mismatches support this.', ['creative', 'pricing', 'promo'])]; },
    check: function () { return 'For two weeks, have staff note why shoppers who leave without buying did not purchase.'; },
    action: function () { return 'For two weeks, ask staff to jot down a quick reason whenever someone walks out without buying, and line it up with the till records for those days. You’ll quickly see whether it’s staffing, stock or price.'; },
    confirm: function () { return 'Staff notes on lost sales next to till records'; },
    record: function () { return 'Lost-sale notes alongside till records'; } });

  /* ---- Growth when things are going well ---- */
  R({ id: 'growth', goals: [], pri: 0,
    when: function (c) { var e = c.any('q6', ['improving']).concat(c.any('q9', ['many_return', 'profitable', 'improves', 'stronger_after', 'relevant', 'match', 'clear_proof', 'nearby', 'in_area', 'clear']));
      return e.length ? e : null; },
    area: function (c) { return 'where your next ' + c.o + ' are most likely to come from'; },
    link: function () { return 'Nothing in your answers points to an obvious leak, so the real question is which source can grow without the quality dropping.'; },
    impact: function (c) { return 'Before you spend more, it’s worth knowing whether your best source can take more budget without the quality of ' + c.o + ' slipping.'; },
    why: function (c) { return [E('Your best-performing source may have room to grow before returns fall.', 'Increase spend or effort on that source in small steps and watch cost per ' + SINGLE[c.b] + '. If the cost stays steady, there’s room to grow it.', ['budget']),
      E('A second source may be performing better than it looks because it is not fully tracked.', 'Ask new customers how they found you for a month and compare with your reported sources. If a source comes up more than your reports suggest, it’s doing more than you think.', ['tracking', 'new_channel'])]; },
    check: function (c) { return 'Compare ' + c.o + ' and cost per ' + SINGLE[c.b] + ' by source over the last three months, and check whether quality held as volume rose.'; },
    action: function (c) {
      var best = (c.val('q10') || []).filter(function (x) { return ['cant_tell', 'not_sure', 'none_produced', 'have_none', 'another', 'other'].indexOf(x) < 0; }).map(function (x) { return c.label('q10', x); })[0];
      return 'Rank your sources by ' + c.o + ' and cost per ' + SINGLE[c.b] + ' over the last quarter' + (best ? ', starting with ' + best + ', which you said brings the most' : '') + '. Increase one source in steps while watching whether quality holds, rather than all at once.'; },
    confirm: function () { return 'Results by source over time'; },
    record: function () { return 'Three months of results by source'; } });

  /* ---- Readiness when not marketing ---- */
  R({ id: 'readiness', goals: [], pri: 1,
    when: function (c) { var e = c.any('q5', ['none']).concat(c.any('q6', ['not_spending'], 0.5)).concat(c.any('q10', ['referrals', 'existing', 'direct', 'platforms', 'have_none'], 0.5));
      return c.is('q5', 'none') ? e : null; },
    area: function (c) { return 'which of your current sources could grow before you add paid marketing'; },
    link: function () { return 'You’re not actively marketing yet, so the first job is understanding what already brings customers in.'; },
    impact: function (c) { return 'Knowing where your current ' + c.o + ' come from tells you what to build on first, and what any paid channel has to beat.'; },
    why: function () { return [E('Referrals or existing customers may be an underused source.', 'Count how many new customers in the last three months came from referrals or repeat customers. If a decent share came that way without much effort, it’s worth putting more into.', ['retention']),
      E('You may be visible in places, such as maps or platforms, that could do more with little cost.', 'Check your maps and platform profiles for complete details and recent reviews. Gaps support this.', ['local', 'pages'])]; },
    check: function (c) { return 'Record where each new customer came from for the next month before choosing a paid channel.'; },
    action: function (c) { return 'For the next month, record how every new customer found you in your sales or booking records. This gives you a baseline to judge any paid marketing against later.'; },
    confirm: function () { return 'A month of source records'; },
    record: function () { return 'Current customer sources over one month'; } });

  /* ================= ASSEMBLE ================= */

  function score(rule, ev, c) {
    var n = ev.reduce(function (s, e) { return s + e.w; }, 0);
    var s = n * 10 + rule.pri;
    if (rule.goals.indexOf(c.goal) >= 0) s += 6;
    if (rule.id === 'measurement' && c.weakTracking) s += 4;
    if (rule.id === 'measurement' && (c.goal === 'measure' || c.goal === 'unclear')) s += 8;
    if (rule.id === 'growth' && !c.is('q6', 'improving')) s -= 8;
    if (c.outcome === 'improved' && c.attempts.length === 1) { var fx = {}; rule.why(c).forEach(function (w) { w.fix.forEach(function (x) { fx[x] = 1; }); });
      if (c.attempts.some(function (x) { return fx[x]; })) s -= 5; }
    return { n: n, s: s };
  }

  function dedupe(ev) { var seen = {}; return ev.filter(function (e) { if (!e) return false; var k = e.q + ':' + e.code; if (seen[k]) return false; seen[k] = 1; return true; }); }

  function analyse(a) {
    var steps = buildSteps(a), c = context(a);
    if (!c.route.resolved) return null;
    helpers(c, steps);

    var cand = [];
    RULES.forEach(function (rule) {
      var ev = rule.when(c); if (!ev) return;
      ev = dedupe(ev); if (!ev.length) return;
      var sc = score(rule, ev, c);
      if (sc.n < 1) return;
      cand.push({ rule: rule, ev: ev, n: sc.n, s: sc.s });
    });
    cand.sort(function (x, y) { return y.s - x.s; });

    // Growth only leads when there is no corroborated problem
    var problems = cand.filter(function (x) { return x.rule.id !== 'growth'; });
    var strongProblem = problems.some(function (x) { return x.n >= 2; });
    if (strongProblem) cand = cand.filter(function (x) { return x.rule.id !== 'growth'; });
    // If evidence is thin, make sure measurement is in the list
    var picked = cand.slice(0, 3);
    var meas = cand.filter(function (x) { return x.rule.id === 'measurement'; })[0];
    if (picked.length && picked[0].n < 2 && meas && picked.indexOf(meas) < 0) { picked = picked.slice(0, 2).concat([meas]); }
    // Fallback when nothing is supported
    if (!picked.length) {
      var mr = RULES.filter(function (r) { return r.id === 'measurement'; })[0];
      picked = [{ rule: mr, ev: [], n: 0, s: 0, fallback: true }];
    }
    var labels = ['Check first', 'Check next', 'Monitor'];
    var findings = picked.map(function (p, i) {
      var r = p.rule;
      return { id: r.id, label: labels[i], area: r.area(c), link: r.link(c), impact: r.impact(c), why: r.why(c), check: r.check(c), action: r.action(c),
        confirm: r.confirm(c), record: r.record(c), evidence: p.ev.slice(0, 3), strength: p.n, fallback: !!p.fallback };
    });

    applyAttempts(c, findings);
    var ov = overview(c, findings), rp = report(c, findings);
    var nExp = rp.explain.reduce(function (t, g) { return t + g.items.length; }, 0);
    ov.locked = { areas: rp.supporting.length, explanations: nExp, steps: rp.actions.length, metrics: rp.measures.length, tried: c.attempts.length > 0 };
    return { c: c, steps: steps, findings: findings, overview: ov, report: rp };
  }


  /* ---------- Previous attempts ----------
     Uses only the structured answers (what changed + the combined outcome). An attempted fix
     never marks a problem as solved: it changes what we ask the visitor to check first. */
  var ATTEMPT_NOUN = {
    targeting: 'your targeting change', creative: 'your new creative or messaging', budget: 'your budget change', new_channel: 'your new channel',
    promo: 'your new promotions', pricing: 'your price or package change', delivery: 'your delivery fee change', checkout: 'your checkout or payment change',
    pages: 'your page or listing improvements', website: 'your website changes', speed: 'your page speed improvements', tracking: 'your tracking changes',
    response: 'your faster replies or follow-up', reminders: 'your reminders, confirmations or deposits', qualify: 'your new enquiry questions or filters',
    proof: 'your new reviews, testimonials or case studies', proposals: 'your changes to proposals or sales conversations', onboarding: 'your onboarding or trial changes',
    retention: 'your follow-ups, loyalty or win-back messages', capacity: 'your staffing, stock, slot or hours changes', staff: 'your staff training or in-store changes',
    local: 'your local listing updates', stockists: 'your new stockists or where-to-buy information', other: 'the other change you described'
  };
  var OUTCOME_LABEL = { improved: 'results improved', no_change: 'no clear change', worse: 'results got worse', too_early: 'too early to tell', not_measured: 'not measured yet', unknown: 'result not given' };
  function nounList(codes) {
    var n = codes.map(function (x) { return ATTEMPT_NOUN[x] || 'another change'; });
    if (n.length === 1) return n[0];
    if (n.length === 2) return n[0] + ' and ' + n[1];
    return n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  }
  function relatedAttempts(c, f) {
    if (!c.attempts.length) return [];
    var fix = {}; f.why.forEach(function (w) { w.fix.forEach(function (x) { fix[x] = 1; }); });
    return c.attempts.filter(function (x) { return fix[x]; });
  }
  // Note, replacement check and first action for a finding linked to earlier changes.
  function attemptEffect(c, rel, f) {
    if (c.attempts.length > 1) return combinedEffect(c, rel, f);
    var nouns = nounList(rel), area = f ? f.area : 'this area';
    var before = 'compare ' + c.o + ' for the same length of time before and after the change, using your own records' + (c.paid ? ' instead of just the ad reports' : '');
    var partial = c.b === 'A' || c.b === 'B' ? 'part of your traffic' : 'some of your customers or locations';
    var o = c.outcome, e = {};
    if (o === 'improved') {
      e.note = 'You said things got better after ' + nouns + '. That’s good news, though it doesn’t prove this is fixed, or that the change is what did it.';
      e.short = 'You said things got better after ' + nouns + ', so start by making sure that’s really the case.';
      e.check = cap(before) + ', and see whether ' + area + ' has actually improved and stayed that way.';
      e.quick = 'Take another look at ' + area + ' since ' + nouns + ', and check in your own records that ' + c.o + ' really went up and stayed up.';
      e.title = 'Confirm what improved'; e.tag = 'You’ve already changed this and things improved, which fits. Worth confirming in your own numbers.';
    } else if (o === 'no_change') {
      e.note = 'You said nothing much changed after ' + nouns + '. That doesn’t rule this out, though. The change might not be working everywhere, it might have been judged too early or on the wrong number, or something else might matter more.';
      e.short = 'You said nothing much changed after ' + nouns + '. That doesn’t rule this out, so start by checking the change itself.';
      e.check = 'Start by checking ' + nouns + ' everywhere people would see it, phones included, to make sure it actually works. Then ' + before + '. If both look fine, move on to the other possible causes below.';
      e.quick = 'Make sure ' + nouns + ' actually works everywhere people see it, phones included, then take another look at ' + area + '.';
      e.title = 'Check your earlier change before trying something new'; e.tag = 'You’ve already changed this and nothing much moved. Make sure the change actually works before ruling this out.';
    } else if (o === 'worse') {
      e.note = 'You said things got worse after ' + nouns + '. It’s worth checking whether that change caused it, or whether something else shifted at the same time, like the season, prices or budget.';
      e.short = 'You said things got worse after ' + nouns + ', so start by checking whether that change is what did it.';
      e.check = cap(before) + ', and jot down anything else that changed in those weeks. If the drop lines up with your change and nothing else, think about undoing it, or trying it on ' + partial + ' first.';
      e.quick = 'Compare ' + c.o + ' before and after ' + nouns + ', take another look at ' + area + ' over those weeks, and note anything else that changed.';
      e.title = 'Find out what made things worse'; e.tag = 'You changed this and things got worse. Check whether the change itself caused it.';
    } else if (o === 'too_early') {
      e.note = 'You said it’s too early to tell whether ' + nouns + ' has helped.';
      e.short = e.note;
      e.check = 'Decide now what you’ll judge it on (' + c.o + ', rather than clicks or enquiries) and when, giving it a full buying cycle. Try not to change it again before then.';
      e.quick = 'Decide what you’ll judge ' + nouns + ' on and when, and keep an eye on ' + area + ' in the meantime.';
      e.title = 'Set how you’ll judge your recent change'; e.tag = 'You’ve already changed this, and it’s too early to know if it helped.';
    } else {
      e.note = (o === 'not_measured' ? 'You said you haven’t measured what ' + nouns + ' did' : 'You didn’t say what happened after ' + nouns) + ', so we don’t know yet whether it helped.';
      e.short = e.note;
      e.check = cap(before) + ', so you know whether ' + nouns + ' helped before you change anything else here.';
      e.quick = 'Compare ' + c.o + ' for the same length of time before and after ' + nouns + ', and look at ' + area + ' over those periods.';
      e.title = 'Measure the change you already made'; e.tag = 'You’ve already changed this, but nobody has measured what it did yet.';
    }
    return e;
  }
  /* Several changes, one reported result. Never credit or blame an individual change:
     every note, label, check and action talks about the changes together. */
  var COMBINED = { improved: 'better results', worse: 'worse results', no_change: 'no clear change', too_early: 'too early to tell', not_measured: 'not measured yet', unknown: 'no result given' };
  var SHORT = { targeting: 'targeting', creative: 'creative', budget: 'budget', new_channel: 'a new channel', promo: 'promotions', pricing: 'pricing',
    delivery: 'delivery fees', checkout: 'checkout or payment', pages: 'product pages or listings', website: 'the website', speed: 'page speed', tracking: 'tracking',
    response: 'follow-up', reminders: 'reminders or deposits', qualify: 'enquiry filters', proof: 'reviews or case studies', proposals: 'proposals or sales conversations',
    onboarding: 'onboarding', retention: 'follow-ups or loyalty', capacity: 'staffing, stock or hours', staff: 'staff or in-store changes', local: 'local listings',
    stockists: 'stockists', other: 'the other change you described' };
  // "several changes made together, including creative and delivery fees": the ones relevant here first, all named where possible
  function severalIncluding(c, rel) {
    var order = rel.concat(c.attempts.filter(function (x) { return rel.indexOf(x) < 0; }));
    var names = order.map(function (x) { return SHORT[x] || 'another change'; }), shown = names.slice(0, 3);
    var list = shown.length === 1 ? shown[0] : shown.slice(0, -1).join(', ') + ' and ' + shown[shown.length - 1];
    if (names.length > 3) list = shown.join(', ') + ' and ' + (names.length - 3 === 1 ? 'one other' : (names.length - 3) + ' others');
    return 'several changes made together, including ' + list;
  }
  function combinedEffect(c, rel, f) {
    var sev = severalIncluding(c, rel), o = c.outcome, area = f ? f.area : 'this area', e = {};
    var timing = 'Write down when each change went live and look at ' + c.o + ' around each of those dates in your own records';
    if (o === 'improved') {
      e.note = 'You reported better results after ' + sev + '. We can’t tell which change helped, and it doesn’t mean this is fully fixed.';
      e.short = 'You reported better results after ' + sev + '. We can’t tell which change helped.';
      e.check = timing + '. Make sure the improvement has held before giving any one change the credit.';
      e.quick = 'Write down when each of your recent changes went live, then look at ' + area + ' and ' + c.o + ' around those dates to see if the improvement held.';
      e.title = 'Check timing before crediting any one change';
    } else if (o === 'worse') {
      e.note = 'You reported worse results after ' + sev + '. We can’t tell which change contributed.';
      e.short = e.note;
      e.check = timing + ', and note anything else that changed then, like the season, prices or budget. Do this before you undo anything.';
      e.quick = 'Write down when each of your recent changes went live, and look at ' + area + ' and ' + c.o + ' around those dates before undoing anything.';
      e.title = 'Check timing before reversing anything';
    } else if (o === 'no_change') {
      e.note = 'You reported no clear change after ' + sev + '. We can’t tell whether any one of them helped or hurt, so this is still worth looking at.';
      e.short = e.note;
      e.check = 'Make sure each change actually works everywhere people see it, phones included. Then ' + lc(timing) + '. If they all hold up, move on to the other possible causes below.';
      e.quick = 'Make sure each of your recent changes actually works everywhere people see it, phones included, then take another look at ' + area + '.';
      e.title = 'Check your earlier changes before trying something new';
    } else if (o === 'too_early') {
      e.note = 'You said it’s too early to tell how ' + sev + ' have worked out.';
      e.short = e.note;
      e.check = 'Note when each change went live, and decide now what you’ll judge them on (' + c.o + ', rather than clicks or enquiries) and when, giving them a full buying cycle.';
      e.quick = 'Decide what you’ll judge your recent changes on and when, and keep an eye on ' + area + ' in the meantime.';
      e.title = 'Set how you’ll judge your recent changes';
    } else {
      e.note = (o === 'not_measured' ? 'You said you haven’t measured what ' : 'You didn’t say what happened after ') + sev + (o === 'not_measured' ? ' did' : '') + ', so we don’t know yet whether they helped.';
      e.short = e.note;
      e.check = timing + ', so you know whether the changes helped before you change anything else here.';
      e.quick = 'Write down when each of your recent changes went live, and compare ' + c.o + ' and ' + area + ' before and after those dates.';
      e.title = 'Measure the changes you already made';
    }
    e.tag = 'You changed this along with other things' + ({ improved: ', and overall things got better', worse: ', and overall things got worse', no_change: ', and overall nothing much moved',
      too_early: ', and it’s too early to tell how it went', not_measured: ', and the result hasn’t been measured yet' }[o] || '') + '. We can’t tell what part this one played.';
    return e;
  }
  function applyAttempts(c, F) {
    var used = {};
    F.forEach(function (f) {
      var all = relatedAttempts(c, f);
      // Tag every explanation the change addressed, but describe each change once (on the highest finding).
      var rel = all.filter(function (x) { return !used[x]; }); rel.forEach(function (x) { used[x] = 1; });
      f.why = f.why.map(function (w) {
        var hit = w.fix.filter(function (x) { return all.indexOf(x) >= 0; });
        return hit.length ? Object.assign({}, w, { tag: attemptEffect(c, hit, f).tag }) : w;
      });
      if (!rel.length) return;
      var e = attemptEffect(c, rel, f);
      f.attempt = { codes: rel, note: e.note, short: e.short, quick: e.quick, title: e.title, text: e.check };
      f.origCheck = f.check; f.check = e.check;
    });
  }

  /* ---------- Notes: mismatches, conflicts, unknowns ---------- */
  var STAGE_ORDER = ['reach', 'interest', 'followup', 'activate', 'attend', 'convert', 'close', 'post', 'attendance', 'retain'];
  function notes(c, top) {
    var n = { mismatch: null, conflicts: [], unknowns: [] };
    var gs = D.GOAL_STAGE[c.goal];
    if (gs === 'reach' && c.st7 && c.st7 !== 'reach' && STAGE_ORDER.indexOf(c.st7) > 0 && !c.is('q7', 'unknown')) {
      n.mismatch = 'You want to ' + lc(c.label('q4', c.goal)) + ', but you also said people already get as far as “' + lc(c.label('q7', c.val('q7'))) + '”. It’s worth fixing that step before paying to bring in more people, or the new ones may drop out in the same place.';
    }
    if (c.is('q5', 'none') && c.is('q6', 'spend_up_flat', 'profit_flat', 'same_fell'))
      n.conflicts.push('You said you’re not actively marketing, but you also described a change in marketing spend, so we’ve treated that spending answer as background only.');
    if (c.goal === 'noshow' && c.is('q9', 'uncommon'))
      n.conflicts.push('Missed appointments are your priority, but you also said they don’t happen often, so we’ve looked at the rest of the journey too.');
    if (c.is('q6', 'improving') && top && top.id !== 'growth' && top.strength >= 2)
      n.conflicts.push('You said things are improving, and your other answers still point to a gap. Both can be true, since a business can grow while one step quietly leaks.');
    var named = (c.val('q10') || []).filter(function (x) { return ['cant_tell', 'none_produced', 'another', 'not_sure', 'have_none'].indexOf(x) < 0; });
    if (named.length && !c.linked) n.unknowns.push('Whether the channels you think work best really bring in the most ' + c.o + '. From your tracking answers, that’s a gut feel for now, and it hasn’t been checked.');
    else if (named.length && c.linked) n.unknowns.push('Whether the platform reports match your own records. Different platforms often claim the same sale, so their numbers can’t simply be added up.');
    if (c.is('q7', 'unknown')) n.unknowns.push('Where in the journey most people drop out. You said you don’t know yet, which is fine, and finding out is part of the work.');
    var q8 = c.val('q8'); if (q8 && (q8 === 'no_feedback' || (Array.isArray(q8) && q8.indexOf('no_feedback') >= 0))) n.unknowns.push('What customers themselves would say is holding them back, because you’re not collecting that feedback yet.');
    if (c.longCycle || c.is('q6', 'long_cycle')) n.unknowns.push('How your recent enquiries will turn out. With a long sales cycle, only judge a channel on enquiries that are at least one full cycle old.');
    if (c.b === 'B' && c.sub === 'adfunded') n.unknowns.push('How engaged people stay over time. For an ad-funded app, coming back matters more than paying.');
    if (c.b === 'H') n.unknowns.push('How many of the people who stop have simply finished what they came for. That’s a good result, and shouldn’t count as losing them.');
    if (c.b === 'G' && c.goal === 'retain') n.unknowns.push('Which return visits actually make sense. Not every client needs another appointment.');
    if (c.b === 'E') n.unknowns.push('How many reservations will go through. A reservation still isn’t a completed sale or lease.');
    if (c.b === 'I') n.unknowns.push('Whether shoppers are actually buying, since you only see retailer orders. A retailer reordering doesn’t prove shoppers are coming back.');
    n.unknowns.push('Whether your records back this up. Everything here comes from what you’ve noticed, and none of it has been checked against your accounts.');
    return n;
  }

  /* ---------- Overview ---------- */
  function industryWord(c) {
    if (c.neutral) return 'business';
    var i = c.route.industry;
    if (i && i !== 'other') return BR[i].word;
    return BR[c.b].word;
  }

  // "You told us most people stop at X" or, when the first part is a question we asked, "When we asked about Y, you said Z"
  function toldUs(ev) { var j = joinRefers(ev); return /^when we asked/.test(j) ? cap(j) : 'You told us ' + j; }
  function joinRefers(ev) {
    // Answers from the same question are said once: "your answer on X was “a” and “b”"
    var groups = [];
    ev.slice(0, 3).forEach(function (e) { var g = groups.filter(function (x) { return x.q === e.q && x.pre === e.pre; })[0];
      if (g) g.labs = g.labs.concat(e.labs || []); else groups.push({ q: e.q, pre: e.pre, labs: (e.labs || []).slice(), refer: e.refer }); });
    var r = groups.map(function (g) { return g.pre ? g.pre + ' “' + g.labs.join('” and “') + '”' : g.refer; });
    if (r.length === 1) return r[0];
    if (r.length === 2) return r[0] + ', and ' + r[1];
    return r[0] + ', ' + r[1] + ', and ' + r[2];
  }

  function article(w) { return /^[aeiou]/i.test(w) ? 'an ' : 'a '; }
  function goalPhrase(c) { return c.goal === 'unclear' ? 'you are not yet sure what to focus on' : 'you want to ' + lc(c.label('q4', c.goal)); }
  function situationLine(c) {
    var w = industryWord(c), route = c.label('q3', c.sub);
    return 'You run ' + article(w) + w + ' business' + (route ? ', your main sales route is “' + lc(route) + '”,' : '') + ' and ' + goalPhrase(c) + '.';
  }
  function supporting(F) { return F.slice(1).filter(function (f) { return f.evidence.length > 0; }); }

  // Why this matters, in their own terms. Hedged on purpose: we know what they told us, not their numbers.
  function stakes(c, f) {
    var q6 = c.val('q6');
    if (q6 === 'spend_up_flat') return 'You said spending went up and ' + c.o + ' didn’t follow. Until the cause is clear, more budget may just buy more of the same.';
    if (q6 === 'same_fell') return 'You said spending stayed about the same while ' + c.o + ' fell. Something changed, and waiting for it to sort itself out tends to cost more than finding it.';
    if (q6 === 'profit_flat') return 'You said sales grew but profit didn’t. More volume on the same terms may only make that gap bigger.';
    if (q6 === 'promo') return 'You told us your results mainly come when you run promotions. Every promotion may be teaching customers to wait for the next one.';
    if (q6 === 'improving') return 'Things are improving, which is exactly when it’s easiest to put more money behind the wrong thing.';
    if (q6 === 'not_spending' || q6 === 'new') return 'You’re early, which makes this the cheapest time to find the weak spot, before money goes into marketing you can’t judge.';
    return f.fallback ? 'Until you can see which marketing produces ' + c.o + ', every budget decision is a guess.' : f.impact;
  }

  // Free overview. Deliberately limited: one priority finding, a two-sentence explanation tied to their
  // answers, one check they can do now, and the unlock invitation. Supporting findings, alternative
  // explanations, the action plan and metrics stay in the detailed diagnostic.
  function overview(c, F) {
    var f = F[0], o = {};
    o.label = 'Worth investigating first';
    o.main = cap(f.area);
    if (f.fallback) o.why = 'Your answers don’t yet show where most people drop out. Connecting ' + c.o + ' to where they came from would show whether the gap is in attracting people or converting them.';
    else {
      // Always the priority finding's own leading cause. An earlier fix does not rule it out;
      // alternative explanations stay in the detailed report.
      o.why = toldUs(f.evidence.slice(0, 2)) + '. This suggests ' + lc(f.why[0].c.replace(/\.$/, '')) + '.';
    }
    o.check = f.attempt ? f.attempt.quick : f.check;
    o.stakes = stakes(c, f);
    o.invite = 'Get your detailed breakdown, prioritised next steps and the metrics to track.';
    o.sub = 'See what could explain this, what to prioritise and what to measure.';
    return o;
  }

  /* ---------- Detailed report ---------- */
  var MEASURES = {
    A: function (c) { if (c.sub === 'dm') return [['Enquiries that become paid orders', 'How many people who message you end up paying. Messages on their own are interest, not orders.'],
        ['Time from enquiry to payment', 'Long gaps can lead to lost orders; this shows where replies slow down.'], ['Cost per paid order', 'Marketing spend divided by orders that were actually paid, not by messages received.']];
      var m = [['Completed orders', 'Orders that were paid and not cancelled. Clicks and add-to-carts are signals, not orders.'],
        ['Checkout completion', 'The share of people who start checkout and finish paying. It isolates the final step from traffic quality.'],
        ['Cost per completed order', 'Marketing spend divided by completed orders from that marketing, rather than cost per click.']];
      if (c.goal === 'retain') m.push(['Repeat purchase rate', 'The share of customers who buy again within your normal replacement cycle. One-off products will naturally score lower.']);
      return m; },
    B: function (c) { if (c.sub === 'demo') return [['Qualified demos held', 'Demos that took place with a suitable prospect, not demo requests.'], ['Pilot or trial to contract', 'How many evaluations become signed customers.'],
        ['Retained accounts', 'Customers still active after their first renewal point.']];
      if (c.sub === 'adfunded') return [['First useful action', 'The share of new users who do the thing that makes the app worth opening. Installs are not active users.'],
        ['Repeated use in the first month', 'How many users come back in weeks two to four, which matters more than subscriptions for an ad-funded app.'], ['Cost per active user', 'Acquisition spend divided by users who became active, not by installs.']];
      return [['First useful action', 'The share of new users who reach an outcome that shows the product’s value. Logins are not the same.'],
        ['Paid conversion', 'How many users who reached value went on to pay.'], ['Retained usage', 'Users or accounts still active after the first month or renewal.']]; },
    C: function (c) { if (c.sub === 'catering') return [['Confirmed bookings', 'Enquiries that became confirmed events, not enquiries received.'], ['Quote acceptance', 'The share of quotes that are accepted.'], ['Contribution per event', 'What each event earned after food, staff and delivery costs.']];
      if (c.sub === 'dinein') return [['Visits by day and time', 'Covers or visits, so you can see whether marketing fills quiet periods or already-busy ones.'],
        ['Contribution after promotions', 'What promotions earned after the discount, not just the extra visits.'], ['Return visits where measurable', 'How often recognisable customers come back, if you can identify them.']];
      return [['Completed orders', 'Orders delivered or collected, not started baskets.'], ['Contribution after fees and discounts', 'What each order earned after platform commission, delivery and promotion costs.'],
        ['Repeat orders', 'How many customers order again, where the platform or your records show it.']]; },
    D: function (c) { if (c.sub === 'click_collect') return [['Orders collected', 'Orders actually picked up, not placed.'], ['Stock accuracy', 'Whether items shown as available were really in stock.'], ['Time to ready', 'How quickly orders are ready for pickup.']];
      return [['Purchases per visit', 'How many visitors buy. This needs a reasonable visit count, even a manual one on sample days.'], ['Sales of promoted products', 'Whether the items you advertise are the ones selling.'],
        ['Contribution after promotions', 'What promotions earn after the discount, not just the sales they add.']]; },
    E: function () { return [['Qualified enquiries', 'Enquiries matching your budget, location and timing definition, not every form submitted.'], ['Attended viewings', 'Viewings that actually took place, not those booked.'],
        ['Completed transactions from mature enquiry groups', 'Completed sales or leases from enquiries old enough to have finished the cycle. Reservations are not completed sales.'], ['Cost per qualified enquiry', 'Spend divided by qualified enquiries rather than all enquiries.']]; },
    F: function (c) { return [['Qualified enquiries', 'Enquiries that fit your service, budget and client profile.'], ['Attended meetings', 'Meetings that took place, not those booked.'],
        ['Proposal win rate', 'The share of proposals that became signed work, judged over a full sales cycle.']].concat(c.sub === 'retainer' || c.goal === 'renew' ? [['Renewal rate', 'The share of clients who renew when their contract ends.']] : []); },
    G: function (c) { return [['Booking completion', 'Enquiries that became confirmed bookings.'], ['Attended appointments', 'Appointments that took place. Bookings are not attendance.'],
        ['Cancellations and no-shows', 'Missed or cancelled appointments as a share of bookings.']].concat(c.goal === 'retain' ? [['Appropriate return visits', 'Return visits where another visit was genuinely indicated, not all repeat visits.']] : []); },
    H: function (c) { if (c.sub === 'self_paced') return [['Completed purchases', 'Paid course purchases, not checkout starts.'], ['Course starts', 'Buyers who begin the course.'], ['Completion', 'Buyers who finish. Finishing is success, not churn.']];
      return [['Attended trials or consultations', 'Trials that took place, not those booked.'], ['Paid enrolments', 'People who paid, not those who expressed interest.'],
        ['Attendance or completion', 'Whether enrolled people keep attending. Completing a programme is a good outcome.']]; },
    I: function () { return [['Availability where you advertise', 'Whether the product is in stock in stores near your campaigns.'], ['Shopper sell-through', 'What shoppers buy from stores. Retailer orders are a different, later-moving figure.'],
        ['Promotion contribution', 'What promotions earn after trade costs and discounts.']]; }
  };

  function report(c, F) {
    var n = notes(c, F[0]), f = F[0], r = {};
    var ch = (c.val('q5') || []).map(function (x) { return c.label('q5', x); });
    var industryLabel = c.route.industry === 'other' ? 'Other / More than one type' : (find(D.INDUSTRIES, c.route.industry) || {}).label;

    // 1. Your situation
    r.situation = [['Business type', industryLabel]];
    if (c.a._legacySell) r.situation.push(['What you sell', c.a._legacySell]);   // earlier versions only
    if (c.a.r1_desc) r.situation.push(['How customers buy', c.a.r1_desc]);
    r.situation.push(['Main sales route', c.label('q3', c.sub)], ['What you want to improve', c.label('q4', c.goal)],
      ['Marketing channels', ch.length ? ch.join(', ') : 'Not stated']);
    var q6 = c.val('q6'); if (q6) r.situation.push(['Last three months', c.label('q6', q6)]);
    if (c.attempts.length) {
      r.situation.push(['Already tried', c.attempts.map(function (x) { return x === 'other' ? (c.otherTxt ? 'Other: ' + c.otherTxt : 'Something else') : c.label('q12', x); }).join('; ')]);
      r.situation.push([c.attempts.length > 1 ? 'Result of those changes together' : 'Result of that change', cap(OUTCOME_LABEL[c.outcome])]);
    } else if (c.nothingTried) r.situation.push(['Already tried', 'Nothing yet']);
    r.reported = f.fallback ? 'Your answers don’t point clearly to one stage of the journey yet.' : toldUs(f.evidence) + '.';
    r.notes = c.notes;
    r.legacy = !!c.a._legacyAttempt;

    // 2. Priority finding
    r.priority = f;
    r.priorityWhy = f.fallback ? 'Until ' + c.o + ' are connected to where they came from, it is hard to know which spending works, so this comes first.' : f.impact + ' ' + f.link;
    // Goal and reported drop-off disagree: always say so, in a form that fits the priority
    if (n.mismatch) r.priorityWhy += ' ' + (['reach_fit', 'message', 'qualification', 'click_gap'].indexOf(f.id) < 0 ? n.mismatch :
      'You want to ' + lc(c.label('q4', c.goal)) + ', and this finding fits that goal. But you also said people already get as far as “' + lc(c.label('q7', c.val('q7'))) + '”, so check that later step too before bringing in more people.');
    if (c.is('q6', 'spend_up_flat')) r.priorityWhy += ' And since you’re spending more without more ' + c.o + ' to show for it, either the extra money is reaching the wrong people or something further along is losing them. Your answers alone can’t say which channel is to blame.';
    if (c.is('q6', 'new', 'not_spending')) r.priorityWhy += ' You’re early or not spending yet, so treat this as getting ready, rather than a sign that something has gone wrong.';
    r.strength = f.fallback ? '' : f.strength < 2 ? 'Only one of your answers points here, so treat it as a lead worth checking.' : 'Several of your answers point here.';

    // 3. Supporting findings (only those backed by answers)
    r.supporting = supporting(F);

    // 4. What could explain this, 5. What to check
    var shown = [f].concat(r.supporting);
    r.explain = shown.map(function (x) { return { area: x.area, items: x.why }; });
    r.conflicts = n.conflicts;
    r.unknowns = n.unknowns.slice(0, 3);
    r.checks = shown.map(function (x) { return { area: x.area, first: x.attempt ? x.check : null, items: x.why }; });
    var recs = []; shown.forEach(function (x) { if (recs.indexOf(x.record) < 0) recs.push(x.record); });
    if (recs.length < 2) { var m = RULES.filter(function (x) { return x.id === 'measurement'; })[0].record(c); if (recs.indexOf(m) < 0) recs.push(m); }
    r.records = recs.slice(0, 3);

    // 6. What to do next (accounts for previous attempts and their outcome)
    var acts = [];
    if (f.attempt) {
      acts.push({ src: f.id, title: f.attempt.title, text: f.attempt.text });
      if (c.outcome === 'improved') { if (r.supporting[0]) acts.push({ src: r.supporting[0].id, title: cap(r.supporting[0].area), text: r.supporting[0].action }); }
      else acts.push({ src: f.id, title: 'Then look at ' + lc(f.area), text: (c.outcome === 'no_change' ? (c.attempts.length > 1 ? 'If your earlier changes check out, this is the next place to look. ' : 'If your earlier change checks out, this is the next place to look. ') : c.outcome === 'worse' ? 'Once you know what caused the drop, come back to this. ' : 'While you wait to see how your change does, you can still look into this. ') + f.action });
    } else acts.push({ src: f.id, title: cap(f.area), text: f.action });
    r.supporting.forEach(function (x) { if (acts.length < 3 && !acts.some(function (y) { return y.src === x.id; })) acts.push(x.attempt ? { src: x.id, title: x.attempt.title + ' (' + x.area + ')', text: x.attempt.text } : { src: x.id, title: cap(x.area), text: x.action }); });
    var unrelated = c.attempts.filter(function (x) { return !shown.some(function (y) { return y.attempt && y.attempt.codes.indexOf(x) >= 0; }); });
    if (unrelated.length && acts.length < 3 && c.attempts.length > 1) {
      var linked = shown.some(function (y) { return y.attempt; });
      acts.push(linked ? { src: 'attempts', title: 'Add your other changes to that list',
          text: (unrelated.length > 1 ? 'Your changes to ' : 'Your change to ') + (function (n) { return n.length === 1 ? n[0] : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1]; })(unrelated.map(function (x) { return SHORT[x] || 'another area'; })) + ' ' + (unrelated.length > 1 ? 'were' : 'was') + ' part of the same overall result, so put ' + (unrelated.length > 1 ? 'them' : 'it') + ' on that list of dates too, and judge everything together.' }
        : { src: 'attempts', title: 'Judge your earlier changes together', text: 'You reported ' + COMBINED[c.outcome] + ' after ' + severalIncluding(c, []) + '. We can’t tell which change contributed. Write down when each one went live and look at ' + c.o + ' around those dates before you build on any of them or undo them.' });
    } else if (unrelated.length && acts.length < 3) {
      var un = nounList(unrelated);
      var t = { improved: 'You said things got better. Keep an eye on whether that lasts, and judge it on ' + c.o + ' rather than clicks or enquiries.',
        no_change: 'You said nothing much changed. Before building on ' + un + ', make sure it was judged on ' + c.o + ' and given long enough.',
        worse: 'You said things got worse. Check whether ' + un + ' caused it, or something else that changed around the same time.',
        too_early: 'You said it’s too early to tell. Pick the date and the number you’ll judge it on.',
        not_measured: 'Compare ' + c.o + ' before and after ' + un + ' so you know whether it helped.', unknown: 'Compare ' + c.o + ' before and after ' + un + ' so you know whether it helped.' }[c.outcome];
      acts.push({ src: 'attempts', title: 'Keep an eye on ' + un, text: 'This isn’t directly linked to what’s above, but it’s still worth tracking. ' + t });
    }
    r.actions = acts.slice(0, 3);

    // 7. What to measure
    r.measures = MEASURES[c.b](c).slice(0, 4);
    r.limited = c.neutral;
    r.glance = { priority: cap(f.area), next: r.actions[0].title };

    // Keep it readable: trim the least important detail first.
    function wc() { return reportText(r).split(/\s+/).filter(Boolean).length; }
    var trims = [
      function () { if (r.unknowns.length > 2) { r.unknowns = r.unknowns.slice(0, 2); return true; } },
      function () { if (r.measures.length > 3) { r.measures = r.measures.slice(0, 3); return true; } },
      function () { if (r.records.length > 2) { r.records = r.records.slice(0, 2); return true; } },
      function () { if (r.supporting.length > 1) { var gone = r.supporting[r.supporting.length - 1];
        r.supporting = r.supporting.slice(0, -1); r.explain = r.explain.slice(0, -1); r.checks = r.checks.slice(0, -1);
        r.actions = r.actions.filter(function (x, i) { return i === 0 || x.src !== gone.id; }); return true; } }
    ];
    for (var ti = 0; ti < trims.length && wc() > 1000; ti++) trims[ti]();
    return r;
  }

  /* ---------- Plain-text versions for the lead record ---------- */
  function overviewText(o) { return [o.label + ': ' + o.main, o.why, 'Why this matters: ' + o.stakes, 'Check first: ' + o.check].join('\n'); }
  function reportText(r) {
    var L = [];
    L.push('1. YOUR SITUATION'); r.situation.forEach(function (x) { L.push(x[0] + ': ' + x[1]); });
    L.push(r.reported); if (r.notes) L.push('Your notes: ' + r.notes);
    L.push('', '2. THE MAIN THING TO LOOK AT: ' + r.priority.area, r.priorityWhy);
    if (r.priority.attempt) L.push(r.priority.attempt.note);
    if (r.strength) L.push(r.strength);
    if (r.supporting.length) { L.push('', '3. ALSO WORTH A LOOK'); r.supporting.forEach(function (x) { L.push('- ' + x.area + ': ' + x.impact + (x.attempt ? ' ' + x.attempt.note : '')); }); }
    L.push('', '4. WHAT COULD BE BEHIND IT (possible causes, none confirmed yet)');
    r.explain.forEach(function (g) { L.push(g.area + ':'); g.items.forEach(function (w) { L.push('- ' + w.c + (w.tag ? ' (' + w.tag + ')' : '')); }); });
    r.conflicts.forEach(function (x) { L.push('Note: ' + x); });
    L.push('What we don’t know yet: ' + r.unknowns.join(' | '));
    L.push('', '5. HOW TO CHECK');
    r.checks.forEach(function (g) { L.push(g.area + ':'); if (g.first) L.push('- Start here: ' + g.first); g.items.forEach(function (w) { L.push('- ' + w.k); }); });
    L.push('Records worth pulling together: ' + r.records.join(' | '));
    L.push('', '6. WHAT TO DO NEXT'); r.actions.forEach(function (a, i) { L.push((i + 1) + '. ' + a.title + ': ' + a.text); });
    L.push('', '7. WHAT TO MEASURE'); r.measures.forEach(function (m) { L.push('- ' + m[0] + ': ' + m[1]); });
    return L.join('\n');
  }

  /* ---------- Older saved answers ----------
     Reports saved before the structured previous-attempts question used a single choice plus free text.
     We keep the free text as context only and never guess what changed from it. */
  function migrate(a) {
    if (!a || typeof a !== 'object') return a;
    var out = JSON.parse(JSON.stringify(a)), notes = [];
    // Version 1: previous attempts were one choice plus free text
    if (typeof out.q12 === 'string') {
      var old = out.q12, txt = (out['q12:txt'] || '').trim();
      delete out.q12; delete out['q12:txt'];
      if (old === 'not_tried') out.q12 = ['nothing'];
      if (old === 'tried') { out._legacyAttempt = '1'; if (txt) notes.push('What you tried: ' + txt); }
    }
    // Versions 1 and 2: standalone text screens that have since been removed. Kept as context only, never scored.
    if (out.q2) { out._legacySell = String(out.q2); }
    if (out.q12c) notes.push(String(out.q12c));
    delete out.q2; delete out.q12c;
    if (notes.length) out._legacyNote = notes.join(' ');
    return out;
  }

  // Progress: the visitor's real path so far, plus the remaining screens assuming a typical answer to each.
  // It can shrink when an answer skips a follow-up (for example "Nothing yet" or "We do not know").
  function projectedCount(a) {
    var t = JSON.parse(JSON.stringify(a || {})), guard = 0, st = buildSteps(t);
    while (guard++ < 40) {
      var s = st.filter(function (x) { return t[x.key] === undefined; })[0];
      if (!s) break;
      if (s.text) t[s.key] = '';
      else { var o = s.o.filter(function (x) { return !x.x && !x.to && x.code !== 'unknown' && x.code !== 'other' && x.code !== 'na'; })[0] || s.o[0]; t[s.key] = s.multi ? [o.code] : o.code; }
      st = buildSteps(t);
    }
    return st.length;
  }

  var API = { projectedCount: projectedCount, buildSteps: buildSteps, prune: prune, route: route, context: context, analyse: analyse, overviewText: overviewText, reportText: reportText, migrate: migrate, RULES: RULES, VERSION: 2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.TMO_RULES = API;
})(this);

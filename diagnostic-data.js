/* The Morning Owl marketing diagnostic: question bank and routing.
   Everything visitor-facing lives here so wording can be reviewed in one place.
   Option format: [code, label, flags]. Flags: x = exclusive, txt = optional text box. */
(function (root) {
  'use strict';

  function O(code, label, flags) { return Object.assign({ code: code, label: label }, flags || {}); }
  var X = { x: true };
  var OTHER = function (label) { return O('other', label || 'Other (tell us)', { txt: true }); };
  var NA = O('na', 'Not applicable to us', X);

  var INDUSTRIES = [
    O('A', 'Ecommerce / Online retail'),
    O('B', 'SaaS / Apps / Software'),
    O('C', 'Restaurants / Cafés / Food outlets'),
    O('D', 'Retail stores / Physical shops'),
    O('E', 'Real estate / Property'),
    O('F', 'Professional services / Agencies / B2B'),
    O('G', 'Healthcare / Beauty / Wellness'),
    O('H', 'Education / Coaching / Fitness'),
    O('I', 'Consumer brands / Packaged food and beverages'),
    O('other', 'Other / More than one type')
  ];

  // R1 for Other / mixed businesses. Each option routes to a branch.
  var R1 = [
    O('online', 'They order products online', { to: 'A' }),
    O('digital', 'They sign up for or use a digital product', { to: 'B' }),
    O('shop', 'They visit our location to shop', { to: 'D' }),
    O('eat', 'They visit our location to eat, or order food from us', { to: 'C' }),
    O('quote', 'They enquire, discuss their needs and receive a quote', { to: 'F' }),
    O('property', 'They enquire about a property to buy, rent or lease', { to: 'E' }),
    O('health', 'They book a health, beauty or wellness appointment', { to: 'G' }),
    O('class', 'They book a class, course, coaching or programme', { to: 'H' }),
    O('retailers', 'They buy our products through retailers or distributors', { to: 'I' }),
    O('another', 'Another way', { to: 'F', neutral: true })
  ];


  /* ---------------- Branches ---------------- */
  var BR = {};

  BR.A = {
    q8pre: true, // q8 asks about the time before purchase, so it is skipped for repeat-business goals
    word: 'ecommerce', outcome: 'completed orders', people: 'shoppers',
    q3: { t: 'Where do customers mainly buy your products?', o: [
      O('website', 'Our website'), O('marketplace', 'A marketplace such as Shopee, Lazada or Amazon'),
      O('tiktok', 'TikTok Shop'), O('dm', 'WhatsApp, Instagram or other direct messages'), OTHER('Other (tell us)')] },
    q4: { o: [O('acquire', 'Get more relevant visitors'), O('convert', 'Turn more visitors or enquiries into orders'),
      O('cost', 'Reduce the cost of getting an order'), O('retain', 'Get customers to buy again'),
      O('measure', 'Understand which marketing works'), O('unclear', 'Not sure yet')] },
    q5: [O('meta', 'Meta ads'), O('google', 'Google ads'), O('tiktok_ads', 'TikTok ads'), O('mkt_ads', 'Marketplace or retail-media ads'),
      O('organic', 'Organic social content or livestreams'), O('creators', 'Creators or affiliates'), O('seo', 'Search / SEO'),
      O('crm', 'Email, SMS or WhatsApp'), O('partners', 'Partnerships or referrals')],
    q7: function (c) {
      if (c.sub === 'dm') return { t: 'Where do customers most often stop before buying?', o: [
        O('before_msg', 'Before messaging us', { st: 'reach' }), O('after_ask', 'After asking about the product', { st: 'interest' }),
        O('after_price', 'After receiving the total price or delivery details', { st: 'convert' }),
        O('after_payinfo', 'After receiving payment instructions', { st: 'convert' }), O('unknown', 'We do not know', X)] };
      if (c.sub === 'marketplace' || c.sub === 'tiktok') return { t: 'Where do shoppers most often stop before buying?', help: 'Choose the stage you can actually see in your seller reports.', o: [
        O('before_click', 'Before clicking through to our listing', { st: 'reach' }),
        O('listing_no_order', 'After viewing the listing, before ordering', { st: 'interest' }),
        O('cancel', 'After ordering (cancelled or unpaid orders)', { st: 'convert' }), O('unknown', 'We do not know', X)] };
      return { t: 'Where do shoppers most often stop before buying?', o: [
        O('before_click', 'Before clicking through to products', { st: 'reach' }),
        O('before_cart', 'After viewing products, before adding to cart', { st: 'interest' }),
        O('before_checkout', 'After adding to cart, before checkout', { st: 'convert' }),
        O('checkout', 'During checkout or payment', { st: 'convert' }),
        O('after_msg', 'After messaging us', { st: 'followup' }), O('unknown', 'We do not know', X)] };
    },
    q8: { t: 'What concerns do shoppers mention most often?', max: 2, refer: 'shoppers raise', o: [
      O('price', 'Price or value'), O('delivery', 'Delivery charges or delivery time'), O('fit', 'Whether the product suits their needs'),
      O('trust', 'Quality, authenticity or trust'), O('payment', 'Payment options'), O('stock', 'Stock availability or choice'),
      O('none', 'No recurring concern has been reported', X), O('no_feedback', 'We do not collect this feedback', X)] },
    q9: {
      acquire: { t: 'What do you notice about the people your marketing reaches?', o: [O('few_see', 'Too few people see it'),
        O('no_click', 'People see it but rarely click'), O('wrong_want', 'People click but often want something we do not sell'),
        O('clicks_no_visits', 'Clicks are reported, but store visits look much lower'), O('unknown', 'We do not know', X)] },
      convert: { t: 'Is this drop-off concentrated anywhere?', o: [O('few_products', 'One or a few products'), O('one_source', 'One marketing source'),
        O('mobile', 'Mostly mobile shoppers'), O('across', 'Across most products and sources'), O('not_compared', 'We have not compared', X)] },
      cost: { t: 'Which best describes orders from your marketing?', o: [O('low_aov', 'Order values are low relative to acquisition cost'),
        O('discounts', 'Orders rely on discounts'), O('buy_once', 'Customers buy once and rarely return'),
        O('returns', 'Returns or cancellations reduce what we earn'), O('unknown_cpo', 'We do not know the cost per completed order'),
        O('none', 'None of these / Not sure', X)] },
      retain: { t: 'Which best describes repeat buying?', o: [O('few_return', 'Products should be bought regularly, but few customers return'),
        O('promo_return', 'Customers mainly return during promotions'), O('no_followup', 'We rarely follow up after delivery'),
        O('long_cycle', 'Our products have a long replacement cycle'), O('many_return', 'Many customers already return'),
        O('not_tracked', 'We do not track repeat buying', X)] },
      measure: { t: 'What makes performance hardest to judge?', o: [O('overlap', 'Platforms claim overlapping or conflicting sales'),
        O('tracking_missing', 'Tracking is missing or unreliable'), O('elsewhere', 'Purchases happen elsewhere'),
        O('no_profit', 'We cannot connect orders to profit'), O('unsure_reports', 'We are unsure how to interpret reports')] }
    }
  };

  BR.B = {
    word: 'software', outcome: 'paying customers', people: 'users',
    q3: { t: 'How do people become paying customers?', o: [
      O('trial', 'Self-service free trial, then paid plan'), O('freemium', 'Free plan, then paid upgrade'),
      O('payfirst', 'Pay before using the product'), O('demo', 'Demo or sales conversation, then contract'),
      O('adfunded', 'Free app funded mainly by ads'), O('usage', 'Usage-based or in-app purchases'), OTHER()] },
    q4: function (c) { return { o: [O('acquire', 'Get more relevant signups or leads'),
      O('convert', c.sub === 'adfunded' ? 'Help new users reach value and keep using the app' : 'Help new users reach value and convert'),
      O('cost', 'Reduce acquisition cost'), O('retain', 'Keep users or customers active for longer'),
      O('measure', 'Understand which marketing works'), O('unclear', 'Not sure yet')] }; },
    q5: [O('search_ads', 'Google or other search ads'), O('meta', 'Meta ads'), O('tiktok_ads', 'TikTok ads'), O('linkedin', 'LinkedIn ads'),
      O('appstore_ads', 'App-store advertising'), O('organic', 'Organic social or content'), O('seo', 'Search / SEO / App-store optimisation'),
      O('partners', 'Partners, affiliates or referrals'), O('lifecycle', 'Email or lifecycle messages'), O('outbound', 'Outbound sales or events')],
    q7: function (c) {
      if (c.sub === 'demo') return { t: 'Where do potential customers most often stop progressing?', o: [
        O('before_signup', 'Before requesting a demo', { st: 'reach' }), O('qualification', 'At qualification', { st: 'followup' }),
        O('demo_attend', 'A demo is booked but not attended', { st: 'attend' }),
        O('evaluation', 'During evaluation or procurement', { st: 'close' }), O('at_renew', 'At renewal', { st: 'retain' }),
        O('unknown', 'We do not know', X)] };
      var o = [O('before_signup', c.sub === 'payfirst' ? 'Before buying or signing up' : 'Before signup, install or demo request', { st: 'reach' }),
        O('before_setup', 'After signup or install, before setup', { st: 'activate' }),
        O('before_useful', 'After setup, before completing a useful action', { st: 'activate' })];
      if (c.sub !== 'payfirst' && c.sub !== 'adfunded') o.push(O('before_pay', 'After trying the product, before paying', { st: 'convert' }));
      o.push(O('at_renew', c.sub === 'adfunded' ? 'After first use, before coming back' : 'After becoming customers, when renewing or using again', { st: 'retain' }));
      o.push(O('unknown', 'We do not know', X));
      return { t: 'Where do people most often stop progressing?', o: o };
    },
    q8: function (c) { return { t: c.sub === 'demo' ? 'How do you know a new customer is getting value during a pilot or onboarding?' : 'How do you know a new user has received value?', refer: 'when we asked about how you know users get value, you said', o: [
      O('tracked_action', 'We track a specific useful action or outcome'), O('logins', 'We mainly track logins or opens'),
      O('setup', 'We mainly track setup completion'), O('feedback_only', 'We hear it in feedback but do not track it'),
      O('undefined', 'We have not defined it yet')] }; },
    q9: {
      acquire: { t: 'What best describes new signups or leads?', o: [O('too_few', 'Too few arrive'), O('mismatch', 'Many do not match our intended customer'),
        O('wrong_expect', 'They expect something the product does not offer'), O('match_no_start', 'They match our audience but rarely start using it'),
        O('not_checked', 'We have not checked', X)] },
      convert: function (c) { var o = [O('effort', 'Setup or learning takes too much effort'), O('cant_see', 'They cannot see how it solves their problem'),
        O('missing_feature', 'A required feature or integration is missing')];
        if (c.sub !== 'adfunded' && c.sub !== 'payfirst') o.push(O('free_enough', 'The free version is enough'));
        if (c.sub !== 'adfunded') o.push(O('price', 'Price or payment commitment'));
        o.push(O('no_feedback', 'We have no consistent feedback', X));
        return { t: 'What do users most often say holds them back?', o: o }; },
      cost: function (c) { return { t: 'How far can you follow acquired users?', o: [O('to_clicks', 'Only to clicks or installs'), O('to_signup', 'To signup or trial'),
        O('to_useful', 'To the first useful action'), O('to_paid', c.sub === 'adfunded' ? 'To repeated use' : 'To paid conversion'),
        O('to_retained', c.sub === 'adfunded' ? 'To retained active users' : 'To retained paying customers and revenue'), O('cant_track', 'We cannot track reliably', X)] }; },
      retain: { t: 'What is the clearest pattern in users who leave?', o: [O('never_value', 'They never reached a useful first outcome'),
        O('no_habit', 'They tried it but never formed a habit'), O('after_promo', 'They stopped after a promotion or trial'),
        O('price_func', 'They cite price, missing functionality or reliability'), O('need_ended', 'Their original need ended'),
        O('not_compared', 'We have not compared users who stay and leave', X)] },
      measure: { t: 'Where is your measurement gap?', o: [O('web_app', 'Website visits cannot be linked to app users'),
        O('signup_paid', 'Signups cannot be linked to paying customers'), O('no_retention', 'We track acquisition but not later retention'),
        O('sales_unlinked', 'Sales-led deals are not linked to marketing'), O('disagree', 'Different systems disagree'), O('not_sure', 'Not sure', X)] }
    }
  };

  BR.C = {
    q8pre: true, // q8 asks about the time before purchase, so it is skipped for repeat-business goals
    word: 'food outlet', outcome: 'visits or orders', people: 'customers',
    q3: { t: 'Which part of your business do you want to improve?', help: 'If more than one applies, choose the one you most want to focus on. You can run the check again for another.', o: [
      O('dinein', 'Dine-in visits'), O('takeaway', 'Takeaway or direct delivery orders'), O('platforms', 'Orders through delivery platforms'),
      O('catering', 'Catering, events or group orders')] },
    q4: { o: [O('acquire', 'Bring in more new customers'), O('convert', 'Turn more interest into visits or orders'),
      O('promo', 'Improve the return from marketing and promotions'), O('retain', 'Bring customers back more often'),
      O('measure', 'Understand which marketing works'), O('unclear', 'Not sure yet')] },
    q5: [O('meta', 'Meta ads'), O('gmaps_ads', 'Google / Maps ads'), O('tiktok_ads', 'TikTok ads'), O('organic', 'Organic social content'),
      O('creators', 'Food creators or influencers'), O('reviews', 'Google Maps / Search / Reviews'), O('platform_promos', 'Delivery-platform promotions or ads'),
      O('crm', 'Email, WhatsApp or loyalty messages'), O('local', 'Local partnerships, events or offline promotions')],
    q7: function (c) {
      if (c.sub === 'dinein') return { t: 'Where does interest most often fail to become a visit?', o: [
        O('discover', 'Few people nearby discover us', { st: 'reach' }), O('lookup', 'People look up our menu or location but do not visit', { st: 'interest' }),
        O('reservation', 'People start a reservation but do not complete it', { st: 'convert' }),
        O('no_attend', 'People book but do not turn up', { st: 'attend' }), O('unknown', 'We do not know', X)] };
      if (c.sub === 'catering') return { t: 'Where do catering or group enquiries most often stop?', o: [
        O('discover', 'Few enquiries arrive', { st: 'reach' }), O('quote', 'Enquiries do not accept the quote', { st: 'close' }),
        O('booking', 'Quotes are agreed but not confirmed as bookings', { st: 'convert' }),
        O('cancel', 'Confirmed bookings are cancelled', { st: 'attend' }), O('unknown', 'We do not know', X)] };
      return { t: 'Where does interest most often fail to become an order?', help: 'Choose the stage you can see in your ordering or platform reports.', o: [
        O('discover', 'Few people nearby discover us', { st: 'reach' }), O('menu_view', 'People view the menu but do not start an order', { st: 'interest' }),
        O('basket', 'People add to basket but do not pay', { st: 'convert' }), O('payment', 'Orders fail at payment', { st: 'convert' }),
        O('cancel', 'Orders are cancelled', { st: 'convert' }), O('unknown', 'We do not know', X)] };
    },
    q8: { t: 'What most limits your ability to serve more customers?', refer: 'when we asked about capacity, you said', o: [
      O('spare', 'We have spare capacity most of the time'), O('peak_full', 'Quiet periods are the main issue; peak times are full'),
      O('waits', 'Long waits or slow fulfilment'), O('staffing', 'Staffing, stock or availability'),
      O('delivery_area', 'Delivery area or platform availability'), O('not_sure', 'Nothing obvious / Not sure', X)] },
    q9: {
      acquire: { t: 'Who does your marketing seem to attract?', o: [O('nearby', 'People nearby who could realistically visit or order'),
        O('outside_area', 'Mostly people outside our area'), O('wrong_price', 'People interested in a different price range or occasion'),
        O('engage_unknown', 'We get engagement but cannot tell who visits'), O('unknown', 'We do not know', X)] },
      convert: function (c) {
        if (c.sub === 'catering') return { t: 'What most often stops a catering enquiry from going ahead?', o: [O('budget', 'Their budget is below our price'),
          O('date_capacity', 'We cannot take the date or group size'), O('menu_fit', 'The menu or service does not fit the event'),
          O('response', 'Slow quotes or follow-up'), O('no_feedback', 'We do not collect this feedback', X)] };
        return { t: 'What concerns do potential customers mention?', o: [O('price', 'Menu price or value'), O('location', 'Location, parking or opening hours'),
          O('delivery_fees', 'Delivery charges, minimum order or delivery time'), O('dietary', 'Dietary suitability or menu choice'),
          O('availability', 'Availability or booking difficulty'), O('no_feedback', 'We do not collect this feedback', X)] }; },
      promo: { t: 'What happens when you run a promotion?', o: [O('low_margin', 'Extra orders leave little margin'),
        O('existing_only', 'Existing customers use it but few new ones arrive'), O('when_full', 'Demand arrives when we are already full'),
        O('unclear_incremental', 'Orders rise but we cannot tell if visits were truly additional'), O('profitable', 'Promotions appear profitable'),
        O('not_measured', 'We have not measured', X)] },
      retain: { t: 'What do you know about return visits or orders?', o: [O('few_return', 'Few return, even though people could come often'),
        O('discount_return', 'They mainly return for discounts'), O('no_contact', 'We have no way to recognise or contact previous customers'),
        O('inconsistent', 'Feedback suggests the experience is inconsistent'), O('tourists', 'We serve mainly tourists or one-off occasions'),
        O('unknown', 'We do not know', X)] },
      measure: { t: 'What makes it difficult to connect marketing to visits or orders?', o: [O('walkins', 'Walk-ins are not linked to a source'),
        O('mixed_orders', 'Delivery-platform and direct orders are mixed together'), O('codes', 'Promotion codes are not captured consistently'),
        O('social_only', 'We mainly track social engagement'), O('not_compared', 'We have records but do not compare them'), O('not_sure', 'Not sure', X)] }
    }
  };

  BR.D = {
    q8pre: true, // q8 asks about the time before purchase, so it is skipped for repeat-business goals
    word: 'retail store', outcome: 'in-store purchases', people: 'shoppers',
    q3: { t: 'Which sales journey do you want to improve?', o: [
      O('one_store', 'Walk-in purchases at one store'), O('multi_store', 'Walk-in purchases across multiple stores'),
      O('online_to_store', 'Online discovery leading to a store visit'), O('click_collect', 'Click-and-collect purchases'),
      O('online', 'Mainly online purchases', { to: 'A' })] },
    q4: { o: [O('acquire', 'Bring more relevant people into the store'), O('convert', 'Turn more visits into purchases'),
      O('promo', 'Improve the return from ads and promotions'), O('retain', 'Get customers to shop with us again'),
      O('measure', 'Understand which marketing works'), O('unclear', 'Not sure yet')] },
    q5: [O('meta', 'Meta ads'), O('gmaps_ads', 'Google / Maps ads'), O('tiktok_ads', 'TikTok ads'), O('organic', 'Organic social content'),
      O('creators', 'Creators or affiliates'), O('reviews', 'Google Maps / Search / Reviews'), O('crm', 'Email, SMS, WhatsApp or loyalty messages'),
      O('mall', 'Mall, local or partner promotions'), O('offline', 'Offline ads or events')],
    q7: function (c) {
      if (c.sub === 'click_collect') return { t: 'Where do click-and-collect orders most often stop?', o: [
        O('product_view', 'People view products online but do not order', { st: 'interest' }),
        O('no_pickup', 'Orders are placed but not collected', { st: 'attend' }), O('cancel', 'Orders are cancelled', { st: 'convert' }),
        O('unknown', 'We do not know', X)] };
      return { t: 'Where is the main gap you can observe?', o: [
        O('discover', 'Few people discover the store', { st: 'reach' }), O('lookup_no_visit', 'People look us up but do not visit', { st: 'interest' }),
        O('visit_no_buy', 'People visit but leave without buying', { st: 'convert' }),
        O('discount_only', 'People buy only heavily discounted items', { st: 'convert' }), O('unknown', 'We do not know', X)] };
    },
    q8: function (c) {
      if (c.sub === 'click_collect') return { t: 'What problems come up with click-and-collect orders?', max: 2, refer: 'the click-and-collect problems you see are', o: [
        O('not_ready', 'Orders are not ready on time'), O('stock_wrong', 'Items shown as in stock are not available'),
        O('pickup_hard', 'Pickup times or location are inconvenient'), O('price', 'Price or value'),
        O('none', 'No recurring issue has been reported', X), O('no_feedback', 'We do not collect feedback', X)] };
      return { t: 'When shoppers leave without buying, what reasons do you hear?', max: 2, refer: 'shoppers who leave mention', o: [
        O('unavailable', 'The right item, size or variant is unavailable'), O('price', 'Price or value'),
        O('browsing', 'They are browsing or comparing'), O('no_help', 'They could not get the help they needed'),
        O('payment', 'Payment or fulfilment options'), O('none', 'No recurring issue has been reported', X),
        O('no_feedback', 'We do not collect feedback', X)] };
    },
    q9: {
      acquire: { t: 'Where are the people your marketing reaches?', o: [O('in_area', 'Within a realistic travel area'), O('too_far', 'Often too far away'),
        O('wrong_people', 'Nearby, but not the shoppers we want'), O('cant_tell', 'We cannot tell', X), O('not_promoted', 'We have not actively promoted the store')] },
      convert: { t: 'Is the problem concentrated anywhere?', o: [O('one_store', 'A particular store'), O('category', 'A product category'),
        O('time', 'A day or time period'), O('new_shoppers', 'New shoppers more than returning shoppers'), O('across', 'Across the business'),
        O('not_compared', 'We have not compared', X)] },
      promo: { t: 'What happens during promotions?', o: [O('margin_falls', 'Sales rise but margin falls'), O('existing_only', 'Existing customers mainly use the offer'),
        O('discounted_only', 'Discounted products sell but little else does'), O('stock_out', 'Demand exceeds stock availability'),
        O('improves', 'Sales and margin seem to improve'), O('not_compared', 'We have not compared', X)] },
      retain: { t: 'How do you encourage another visit?', o: [O('relevant_fu', 'Relevant follow-ups based on purchases'), O('general_offers', 'General offers to past customers'),
        O('discount_loyalty', 'Mainly discount or loyalty offers'), O('no_contact', 'We do not recognise or contact past customers'),
        O('rarely_repurchased', 'Products are rarely repurchased'), O('unknown', 'We do not know', X)] },
      measure: { t: 'What information is missing?', o: [O('visitor_counts', 'Reliable visitor counts'), O('who_buys', 'Which visitors actually buy'),
        O('source_linked', 'Marketing source linked to purchases'), O('repeat_info', 'Repeat-customer information'),
        O('not_combined', 'We have records but do not use them together'), O('not_sure', 'Not sure', X)] }
    }
  };

  BR.E = {
    word: 'property', outcome: 'completed sales or leases', people: 'prospects', longCycle: true,
    q3: { t: 'Which property business are you promoting?', o: [
      O('new_dev', 'New development sales'), O('resale', 'Resale property sales'), O('rentals', 'Residential rentals'),
      O('commercial', 'Commercial property sales or leasing'), O('mgmt', 'Property management services', { to: 'F' })] },
    q4: { o: [O('acquire', 'Get more relevant enquiries'), O('viewings', 'Turn enquiries into attended viewings'),
      O('close', 'Turn viewings or proposals into sales or leases'), O('cost', 'Reduce the cost of getting a qualified enquiry'),
      O('measure', 'Understand which marketing works'), O('unclear', 'Not sure yet')] },
    q5: [O('portals', 'Property portals or listing ads'), O('meta', 'Meta ads'), O('google', 'Google ads'), O('tiktok_ads', 'TikTok ads'),
      O('organic', 'Organic social or property videos'), O('seo', 'Search / SEO'), O('crm', 'Email, WhatsApp or database follow-up'),
      O('agents', 'Agent networks, referrals or partnerships'), O('events', 'Events, roadshows or offline marketing')],
    q7: function (c) { return { t: 'Where do prospects most often stop progressing?', o: [
      O('before_enquiry', 'After viewing the ad or listing, before enquiring', { st: 'reach' }),
      O('before_conv', 'After enquiry, before a meaningful conversation', { st: 'followup' }),
      O('before_book', 'After conversation, before booking a viewing', { st: 'followup' }),
      O('no_attend', 'After booking, before attending a viewing', { st: 'attend' }),
      O('before_agreement', c.sub === 'rentals' ? 'After viewing, before signing a lease' : 'After viewing or proposal, before an agreement', { st: 'close' }),
      O('finance', c.sub === 'rentals' ? 'After application, during checks or documentation' : 'After reservation, during finance or documentation', { st: 'post' }),
      O('unknown', 'We do not know', X)] }; },
    q8: { t: 'How well do enquiries match the properties you offer?', refer: 'when we asked about enquiry fit, you said', o: [
      O('fit', 'Most fit the budget, location and needs'), O('budget', 'Many have a budget mismatch'),
      O('location_type', 'Many want a different location or property type'), O('later', 'Many are researching for much later'),
      O('junk', 'Many are unreachable, duplicate or spam'), O('not_reviewed', 'We have not reviewed enquiry quality', X)] },
    q9: {
      acquire: { t: 'What does your marketing make clear before someone enquires?', o: [O('clear', 'Price range, location and main property details'),
        O('missing_info', 'Some details, but important information is missing'), O('lifestyle', 'Mostly lifestyle or investment messaging'),
        O('inconsistent', 'Details differ across listings or campaigns'), O('not_checked', 'We have not checked', X)] },
      viewings: { t: 'What usually happens after an enquiry arrives?', o: [O('prompt', 'A prompt personal response with a clear next step'),
        O('auto_later', 'An automated reply, with personal follow-up later'), O('varies', 'Response timing varies or enquiries are missed'),
        O('unresponsive', 'Several follow-ups happen but prospects remain unresponsive'), O('unknown', 'We do not know', X)] },
      close: { t: 'What most often delays or prevents an agreement?', o: [O('price_finance', 'Price or financing readiness'),
        O('needs_fit', 'Property or location does not meet their needs'), O('decision_maker', 'Decision-maker or co-buyer is not aligned'),
        O('paperwork', 'Timing, paperwork or approvals'), O('other_property', 'They choose another property'),
        O('not_recorded', 'We do not consistently record reasons', X)] },
      cost: { t: 'How do you judge an enquiry as qualified?', o: [O('full_def', 'Confirmed budget, location, need and timeframe'),
        O('viewing_def', 'They booked or attended a viewing'), O('responded_def', 'They responded to a message'),
        O('all_equal', 'Every submitted enquiry is counted equally'), O('no_def', 'We have no consistent definition')] },
      measure: { t: 'How far can you follow an enquiry from its original source?', o: [O('form_only', 'Only to the enquiry form'), O('to_conv', 'To a conversation'),
        O('to_viewing', 'To an attended viewing'), O('to_reservation', 'To reservation or agreement'), O('to_completed', 'To completed sale or lease'),
        O('cant_follow', 'We cannot follow it reliably', X)] }
    }
  };

  BR.F = {
    q8pre: true, // q8 asks about the time before purchase, so it is skipped for repeat-business goals
    word: 'services', outcome: 'new paying clients', people: 'potential clients', longCycle: true,
    q3: { t: 'How do customers usually engage your business?', o: [
      O('quote', 'Enquire and receive a quote'), O('consult', 'Book a consultation or discovery call'),
      O('proposal', 'Go through a demo, proposal or procurement process'), O('fixed', 'Purchase a fixed service directly'),
      O('retainer', 'Renew a contract or retainer'), OTHER()] },
    q4: function (c) { var o = [O('acquire', 'Get more suitable enquiries'), O('meetings', 'Turn enquiries into meetings or proposals'),
      O('close', 'Win more work from proposals'), O('cost', 'Improve acquisition cost or client value')];
      if (c.sub === 'retainer') o.push(O('renew', 'Keep more clients renewing'));
      o.push(O('measure', 'Understand which marketing works'), O('unclear', 'Not sure yet'));
      return { o: o }; },
    q5: [O('google', 'Google ads'), O('meta', 'Meta ads'), O('linkedin', 'LinkedIn ads'), O('organic', 'Organic social or thought leadership'),
      O('seo', 'Search / SEO'), O('outbound', 'Email or outbound prospecting'), O('referrals', 'Referrals or partner introductions'),
      O('events', 'Webinars, events or networking'), O('directories', 'Directories or marketplaces')],
    q7: function (c) {
      if (c.sub === 'fixed') return { t: 'Where do potential clients most often stop?', o: [
        O('view', 'They view the service but do not start a purchase', { st: 'interest' }),
        O('start', 'They start a purchase but do not pay', { st: 'convert' }),
        O('delivery', 'Problems come up during delivery', { st: 'retain' }), O('unknown', 'We do not know', X)] };
      var o = [O('before_enquiry', 'Before enquiring', { st: 'reach' }), O('before_conv', 'After enquiry, before a conversation', { st: 'followup' }),
        O('before_proposal', c.neutral ? 'After a conversation, before a quote or offer' : 'After a conversation, before a proposal', { st: 'followup' }),
        O('before_agreement', c.neutral ? 'After a quote or offer, before agreement' : 'After proposal or quote, before agreement', { st: 'close' }),
        O('procurement', 'During procurement or approval', { st: 'post' }), O('renewal', 'At renewal', { st: 'retain' }),
        O('unknown', 'We do not know', X)];
      if (c.neutral) o.splice(6, 0, NA);
      return { t: c.neutral ? 'Where do potential customers most often stop?' : 'Where do potential clients most often stop?', o: o };
    },
    q8: function (c) { var o = [O('fit', 'Most fit our service, budget and ideal client'), O('diff_service', 'They need a different service'),
      O('low_budget', 'Their budget is usually below our range'), O('no_authority', 'They have no clear timeline or buying authority'),
      O('free_advice', 'They mainly want free advice or price comparisons'), O('not_reviewed', 'We do not review this consistently', X)];
      if (c.neutral) o.push(NA);
      return { t: 'How well do enquiries fit the work you want?', refer: 'when we asked about enquiry fit, you said', o: o }; },
    q9: {
      acquire: { t: 'What does your marketing explain most clearly?', o: [O('clear_proof', 'Who we help, the problem we solve and evidence of results'),
        O('capabilities', 'Our services and capabilities'), O('price_offer', 'Our price or offer'),
        O('broad', 'Broad claims that could fit many providers'), O('not_reviewed', 'We have not reviewed the message', X)] },
      meetings: { t: 'What happens after someone enquires?', o: [O('prompt', 'Prompt personal response and a clear next step'), O('varies', 'Response timing varies'),
        O('no_followup', 'We reply, but do not follow up consistently'), O('no_show', 'Meetings are booked but people do not attend'),
        O('not_ready', 'People engage but are not ready to buy'), O('unknown', 'We do not know', X)] },
      close: { t: 'What reasons do prospects give for not proceeding?', o: [O('roi', 'Price or unclear return on investment'),
        O('proof', 'Not enough confidence, proof or relevant experience'), O('scope', 'Scope or solution does not fit'),
        O('approval', 'Internal approval or timing'), O('competitor', 'Another provider was chosen'), O('not_recorded', 'We do not record reasons', X)] },
      cost: { t: 'Which problem is most relevant?', o: [O('effort_per', 'Too much spending or effort per suitable enquiry'),
        O('small_contracts', 'Too much sales effort for small contracts'), O('discount_margin', 'Discounts or delivery costs reduce margin'),
        O('no_renew', 'Clients do not renew or expand'), O('unknown_cv', 'We do not know acquisition cost or client value'), O('none', 'None of these', X)] },
      renew: { t: 'Why do clients not renew?', o: [O('need_ended', 'Their need ended'), O('results', 'Results were below expectations'),
        O('experience', 'The service experience'), O('price', 'Price or budget'), O('unknown', 'We do not know', X)] },
      measure: { t: 'Where does the source information stop?', o: [O('website_only', 'At the website or campaign report'), O('enquiry', 'At enquiry capture'),
        O('meetings', 'At meetings or proposals'), O('signed', 'We can follow it to signed work'), O('revenue', 'We can follow it to renewals and revenue'),
        O('none_tracked', 'We do not track source information', X)] }
    }
  };

  BR.G = {
    q8pre: true, // q8 asks about the time before purchase, so it is skipped for repeat-business goals
    word: 'health and beauty', outcome: 'attended appointments', people: 'clients',
    q3: { t: 'Which part of your business do you want to improve?', o: [
      O('clinic', 'Clinic or healthcare appointments'), O('beauty', 'Beauty, salon or aesthetic appointments'),
      O('wellness', 'Wellness or therapy sessions'), O('packages', 'Packages or memberships'),
      O('products', 'Product purchases', { to: 'GP' })] },
    q4: { o: [O('acquire', 'Attract more suitable appointment enquiries'), O('convert', 'Turn enquiries into bookings'),
      O('noshow', 'Reduce missed or cancelled appointments'), O('retain', 'Improve repeat bookings or package renewal'),
      O('measure', 'Understand which marketing works'), O('unclear', 'Not sure yet')] },
    q5: [O('gmaps_ads', 'Google / Maps ads'), O('meta', 'Meta ads'), O('tiktok_ads', 'TikTok ads'), O('organic', 'Organic social content'),
      O('reviews', 'Search / SEO / Reviews'), O('creators', 'Creators or local partnerships'), O('directories', 'Booking directories or marketplaces'),
      O('crm', 'Email, SMS or WhatsApp reminders'), O('referrals', 'Professional or customer referrals'), O('offline', 'Offline or local promotions')],
    q7: function () { return { t: 'Where does interest most often stop?', o: [
      O('before_enquiry', 'Before an enquiry or booking attempt', { st: 'reach' }), O('before_booking', 'After an enquiry, before booking', { st: 'followup' }),
      O('booking_process', 'While choosing a slot or completing booking', { st: 'convert' }),
      O('no_attend', 'After booking, before attendance', { st: 'attend' }),
      O('after_first', 'After the first visit, when another visit is appropriate', { st: 'retain' }), O('unknown', 'We do not know', X)] }; },
    q8: { t: 'What most often prevents an interested person from booking?', max: 2, refer: 'the booking barriers you hear about are', o: [
      O('no_slot', 'No suitable appointment time'), O('price', 'Price or unclear total cost'), O('location', 'Location or travel'),
      O('uncertainty', 'Uncertainty about the service or practitioner'), O('slow_booking', 'Slow response or difficult booking process'),
      O('assessment', 'Suitability needs a professional assessment'), O('no_feedback', 'We do not collect this feedback', X)] },
    q9: {
      acquire: { t: 'How well do enquiries match the services you provide?', o: [O('relevant', 'Most are relevant and within our service area'),
        O('wrong_service', 'Many ask for services we do not provide'), O('expectations', 'Many have expectations we cannot meet'),
        O('outside_area', 'Many are outside our area'), O('not_reviewed', 'We have not reviewed this', X)] },
      convert: { t: 'What is the next step after someone enquires?', o: [O('instant', 'They can book a suitable slot immediately'),
        O('prompt_staff', 'Staff confirm details and offer a slot promptly'), O('wait_reply', 'They wait for a reply or confirmation'),
        O('many_msgs', 'They need several messages or calls to book'), O('few_slots', 'There are few suitable slots available'), O('unknown', 'We do not know', X)] },
      noshow: { t: 'What patterns do you see in missed appointments?', o: [O('forget', 'People forget or misunderstand the time'),
        O('reschedule_hard', 'They cannot easily reschedule'), O('long_wait', 'Long waits between booking and appointment'),
        O('expectations_unclear', 'Price or service expectations were unclear'), O('not_recorded', 'Reasons vary or are not recorded', X),
        O('uncommon', 'Missed appointments are uncommon')] },
      retain: { t: 'Which best describes follow-up visits?', o: [O('fu_inconsistent', 'Further visits are appropriate but follow-up is inconsistent'),
        O('intend_not_book', 'People intend to return but do not book'), O('promo_return', 'They return mainly during promotions'),
        O('experience', 'Feedback suggests an experience issue'), O('one_off', 'Many services are one-off or further visits are not indicated'),
        O('unknown', 'We do not know', X)] },
      measure: { t: 'Which outcome can you connect to a marketing source?', o: [O('enquiries_only', 'Enquiries only'), O('bookings', 'Confirmed bookings'),
        O('attended', 'Attended appointments'), O('repeat', 'Appropriate repeat visits or renewals'), O('cant_connect', 'We cannot connect outcomes to sources', X),
        O('not_sure', 'Not sure', X)] }
    }
  };

  BR.H = {
    q8pre: true, // q8 asks about the time before purchase, so it is skipped for repeat-business goals
    word: 'education and fitness', outcome: 'paid enrolments', people: 'prospective students or members',
    q3: { t: 'What do customers mainly sign up for?', o: [
      O('course', 'A course or programme with a start date'), O('membership', 'Ongoing classes or a membership'),
      O('one_to_one', 'One-to-one coaching or tutoring'), O('trial', 'Trial classes before enrolment'),
      O('self_paced', 'A self-paced digital course'), OTHER()] },
    q4: { o: [O('acquire', 'Attract more suitable enquiries or trials'), O('convert', 'Turn interest or trials into paid enrolments'),
      O('attend', 'Improve attendance or completion'), O('renew', 'Improve renewals or continued participation'),
      O('measure', 'Understand which marketing works'), O('unclear', 'Not sure yet')] },
    q5: [O('meta', 'Meta ads'), O('google', 'Google ads'), O('tiktok_ads', 'TikTok ads'), O('linkedin', 'LinkedIn ads'),
      O('organic', 'Organic social or educational content'), O('seo', 'Search / SEO'), O('partners', 'Creators, affiliates or partner organisations'),
      O('crm', 'Email or WhatsApp follow-up'), O('events', 'Open days, events or webinars'), O('referrals', 'Student or member referrals')],
    q7: function (c) {
      if (c.sub === 'self_paced') return { t: 'Where do people most often stop progressing?', o: [
        O('product_view', 'They view the course but do not start checkout', { st: 'interest' }),
        O('checkout', 'They start checkout but do not pay', { st: 'convert' }),
        O('course_start', 'They pay but do not start the course', { st: 'activate' }),
        O('during', 'They start but do not complete', { st: 'attendance' }), O('unknown', 'We do not know', X)] };
      var oto = c.sub === 'one_to_one';
      return { t: 'Where do people most often stop progressing?', o: [
        O('before_enquiry', oto ? 'Before an enquiry or consultation booking' : 'Before an enquiry or trial booking', { st: 'reach' }),
        O('before_trial', oto ? 'After enquiry, before a consultation' : 'After enquiry, before a trial or consultation', { st: 'followup' }),
        O('no_attend', 'After booking, before attending', { st: 'attend' }),
        O('before_pay', oto ? 'After a consultation, before paying for sessions' : 'After a trial or consultation, before paying', { st: 'close' }),
        O('during', 'After enrolment, during attendance or completion', { st: 'attendance' }),
        O('at_renewal', 'At renewal or the next programme', { st: 'retain' }), O('unknown', 'We do not know', X)] };
    },
    q8: { t: 'What concerns do prospective customers most often raise?', max: 2, refer: 'prospective customers raise', o: [
      O('fees', 'Fees or payment commitment'), O('schedule', 'Schedule, location or time required'), O('level', 'Whether the level or programme fits'),
      O('outcomes', 'Confidence in outcomes or teaching quality'), O('payer', 'Approval from a parent, employer or other payer'),
      O('intake', 'The next intake is too far away'), O('no_feedback', 'We do not collect this feedback', X)] },
    q9: {
      acquire: { t: 'How well do enquiries match your programme?', o: [O('match', 'Most match the level, goal and schedule'),
        O('diff_level', 'Many need a different level or outcome'), O('cant_attend', 'Many cannot attend available times or locations'),
        O('not_decider', 'We reach learners but not the person who decides or pays'), O('not_checked', 'We have not checked', X)] },
      convert: function (c) { var o = [];
        if (c.sub !== 'self_paced') o.push(O('clear_rec', 'A clear recommendation and follow-up'), O('general_offer', 'A general offer with little individual guidance'),
          O('fu_varies', 'Follow-up timing varies'));
        o.push(O('wait_start', 'People want to join but must wait for a start date'), O('no_trial', 'There is no trial or consultation; people buy directly'),
          O('unknown', 'We do not know', X));
        return { t: 'What happens after a trial or consultation?', o: o }; },
      attend: { t: 'What reasons do people give for stopping?', o: [O('schedule', 'Schedule or competing commitments'), O('level', 'The level or workload is not suitable'),
        O('no_progress', 'They do not see progress'), O('promise_gap', 'The experience differs from what was promised'),
        O('access', 'Access or support difficulties'), O('not_recorded', 'We do not record reasons', X)] },
      renew: { t: 'What should normally happen after the first programme or term?', o: [O('renew_same', 'Renew the same service'),
        O('progress', 'Progress to a suitable next level'), O('independent', 'Continue independently after achieving the goal'),
        O('new_need', 'Return only when a new need arises'), O('undefined', 'We have not defined a suitable next step')] },
      measure: { t: 'How far can you follow a person from their original source?', o: [O('to_enquiry', 'To an enquiry'), O('to_booked', 'To a booked trial'),
        O('to_attended', 'To an attended trial'), O('to_paid', 'To paid enrolment'), O('to_completion', 'To completion or renewal'),
        O('cant_follow', 'We cannot follow this reliably', X)] }
    }
  };

  BR.I = {
    word: 'consumer brand', outcome: 'shopper purchases', people: 'shoppers',
    q3: { t: 'Where do customers mainly buy the products you want to grow?', help: 'If you sell through several routes, choose the one you most want to focus on.', o: [
      O('own_web', 'Our own website or direct messages', { to: 'A' }), O('marketplace', 'Marketplaces or TikTok Shop', { to: 'A' }),
      O('outlets', 'Our own physical outlets', { to: 'D' }), O('retailers', 'Supermarkets or other retailers'),
      O('distributors', 'Distributors or wholesale partners')] },
    q4: { o: [O('demand', 'Build demand among the right shoppers'), O('convert', 'Turn product interest into purchases'),
      O('promo', 'Improve return from promotions and marketing'), O('retain', 'Increase repeat buying'),
      O('measure', 'Understand which marketing works'), O('unclear', 'Not sure yet')] },
    q5: [O('meta', 'Meta ads'), O('google', 'Google ads'), O('tiktok_ads', 'TikTok ads'), O('organic', 'Organic social or recipe/product content'),
      O('creators', 'Creators or affiliates'), O('retail_media', 'Retailer ads or retail media'), O('instore', 'In-store displays or promotions'),
      O('sampling', 'Sampling, events or partnerships'), O('pr', 'PR or offline advertising'), O('crm', 'Email, WhatsApp or loyalty messages'),
      O('trade', 'Distributor or trade marketing')],
    q7: function () { return { t: 'Where is the biggest gap you can observe?', o: [
      O('no_recognition', 'Shoppers rarely recognise or ask for the brand', { st: 'reach' }),
      O('where_to_buy', 'People show interest but do not know where to buy', { st: 'interest' }),
      O('no_stock', 'People look for it but cannot find stock', { st: 'convert' }),
      O('slow_sell', 'The product is available but sells slowly', { st: 'convert' }),
      O('no_repeat', 'People try it but rarely buy again', { st: 'retain' }), O('unknown', 'We do not know', X)] }; },
    q8: { t: 'What do you know about availability in the places your marketing reaches?', refer: 'when we asked about availability, you said', o: [
      O('reliable', 'Stock and retailer coverage are reliably available'), O('varies', 'Availability varies by store or area'),
      O('oos', 'Out-of-stocks occur often'), O('no_distribution', 'Our marketing reaches areas without distribution'),
      O('no_visibility', 'We do not have reliable store-level visibility')] },
    q9: {
      demand: { t: 'How clearly do shoppers understand when or why to choose your product?', o: [O('clear_use', 'Feedback shows a clear use or buying occasion'),
        O('how_use', 'People recognise it but ask how to use it'), O('not_distinct', 'People struggle to distinguish it from alternatives'),
        O('likes_only', 'We mainly receive likes, not shopper feedback'), O('not_checked', 'We have not checked', X)] },
      convert: { t: 'What do interested shoppers most often ask?', o: [O('where', 'Where they can buy it'), O('how_use', 'How to use or prepare it'),
        O('difference', 'How it differs from alternatives'), O('price_pack', 'Price or pack value'), O('details', 'Suitability, ingredients or product details'),
        O('no_feedback', 'We do not collect this feedback', X)] },
      promo: { t: 'What happens around promotions?', o: [O('rise_fall', 'Sales rise during discounts, then fall back'),
        O('contribution_unclear', 'Volume rises but contribution after trade costs is unclear'),
        O('retailer_orders', 'Retailer orders rise, but shopper purchases are unknown'), O('stock_out', 'Promoted stock runs out'),
        O('stronger_after', 'Sales remain stronger after the promotion'), O('not_compared', 'We have not compared', X)] },
      retain: { t: 'What evidence do you have about buying again?', o: [O('low_repeat', 'Consumer panels, loyalty or direct sales show low repeat'),
        O('experience', 'Feedback suggests taste, performance or experience concerns'), O('discount_buy', 'People mainly buy during discounts'),
        O('long_cycle', 'The category has a long replacement cycle'), O('retailer_only', 'We only see retailer reorders, not shopper repeat'),
        O('unknown', 'We do not know', X)] },
      measure: { t: 'Which sales information can you access?', o: [O('consumer_sales', 'Shopper sales by store or channel and period'),
        O('retailer_orders', 'Retailer or distributor orders only'), O('direct_source', 'Direct online sales with source data'),
        O('totals', 'Overall sales totals only'), O('engagement', 'Marketing engagement only'), O('little', 'Little reliable information')] }
    }
  };

  // G product purchases: extra routing question
  var GP = { t: 'Where are these products mainly bought?', o: [O('online', 'Online', { to: 'A' }), O('in_store', 'In our clinic, salon or store', { to: 'D' })] };

  // Goal -> which Q9 variant and funnel stage
  var GOAL_STAGE = { acquire: 'reach', demand: 'reach', convert: 'convert', viewings: 'followup', meetings: 'followup', close: 'close',
    cost: 'cost', promo: 'cost', retain: 'retain', renew: 'retain', attend: 'attendance', noshow: 'attend', measure: 'measure', unclear: 'measure' };

  /* ---------- Outcome wording per route ---------- */
  function outcomeFor(b, sub, neutral) {
    if (neutral) return { o: 'new paying customers', people: 'potential customers' };
    var d = { o: BR[b].outcome, people: BR[b].people };
    if (b === 'A' && sub === 'dm') d.people = 'customers';
    if (b === 'B') { if (sub === 'adfunded') d.o = 'active users'; if (sub === 'demo') d.o = 'signed customers'; if (sub === 'demo') d.people = 'potential customers'; }
    if (b === 'C') { d.o = sub === 'dinein' ? 'visits' : sub === 'catering' ? 'confirmed catering bookings' : 'completed orders'; }
    if (b === 'D' && sub === 'click_collect') d.o = 'collected orders';
    if (b === 'E') { d.o = sub === 'rentals' ? 'signed leases' : (sub === 'new_dev' || sub === 'resale') ? 'completed sales' : 'completed sales or leases'; }
    if (b === 'G' && sub === 'packages') d.o = 'package sales and renewals';
    if (b === 'H') { d.o = sub === 'membership' ? 'paid memberships' : sub === 'one_to_one' ? 'paying coaching clients' : sub === 'self_paced' ? 'course purchases' : 'paid enrolments'; }
    return d;
  }

  /* ---------- Shared questions ---------- */
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function q6(c) {
    var o = c.o, Oc = cap(o);
    var list = [O('spend_up_flat', 'Spending increased, but ' + o + ' stayed flat or fell'),
      O('profit_flat', 'Spending and ' + o + ' increased, but profit did not improve'),
      O('same_fell', 'Spending stayed similar, but ' + o + ' fell'),
      O('promo', Oc + ' mainly improve when we run promotions'),
      O('improving', Oc + ' are improving and we want to grow further')];
    if (c.longCycle) list.push(O('long_cycle', 'Our sales cycle is longer than three months, so it is too early to judge'));
    if (c.b === 'I') list.push(O('retailer_only', 'We only see retailer or distributor orders, not shopper purchases'));
    list.push(O('not_spending', 'We are not currently spending on marketing'), O('new', 'We are new or do not have enough information yet'));
    return { t: 'Thinking about the last three months, which best describes your marketing spending and ' + o + '?',
      help: c.b === 'H' || c.b === 'C' ? 'If your business is seasonal or intake-based, compare with the same period last year.' : null, o: list };
  }

  function q10(c, ch) {
    var notMarketing = ch.indexOf('none') >= 0;
    if (notMarketing) return { t: 'Where do your current ' + c.o + ' come from?', max: 2, multi: true, help: 'Choose up to two.', o: [
      O('referrals', 'Referrals'), O('existing', 'Existing customers'), O('direct', 'Walk-ins or direct discovery'),
      O('platforms', 'Partners or platforms'), O('have_none', 'We have none yet', X), O('not_sure', 'Not sure', X)] };
    var o = c.q5opts.filter(function (x) { return ch.indexOf(x.code) >= 0; }).map(function (x) { return O(x.code, x.code === 'other' ? 'The other channel you mentioned' : x.label); });
    o.push(O('another', 'Another source (tell us)', { txt: true }), O('cant_tell', 'We cannot tell yet', X), O('none_produced', 'None has produced ' + c.o + ' yet', X));
    return { t: 'Which of these appears to bring you the most ' + c.o + '?', max: 2, multi: true, help: 'Choose up to two. Your best impression is fine.', o: o };
  }

  var RECORDS = { A: 'Order records linked to the original source', B: 'CRM or billing records linked to the original source',
    C: 'Order, booking or till records linked to the original source', D: 'Till (POS) or sales records linked to the original source',
    E: 'Enquiry and sales records linked to the original source', F: 'CRM or sales records linked to the original source',
    G: 'Booking or clinic records linked to the original source', H: 'Enrolment or booking records linked to the original source',
    I: 'Retailer sell-through reports or direct sales records by source' };

  function hasWeb(c) {
    if (c.b === 'C' && c.sub === 'dinein') return false;
    if (c.b === 'D' && (c.sub === 'one_store' || c.sub === 'multi_store')) return false;
    if (c.b === 'I') return false;
    return true;
  }

  function q11(c) {
    var o = [O('platform', 'Reports from advertising or selling platforms')];
    if (hasWeb(c)) o.push(O('analytics', c.b === 'B' ? 'Website or app analytics with tracked links or events' : 'Website analytics with tracked links or events'));
    o.push(O('records', RECORDS[c.b]), O('codes', 'Promotion codes or asking customers how they found us'),
      O('compare', 'We compare marketing activity with overall results'),
      O('reach', 'We mainly track reach, likes or clicks', { xg: 'linked' }), O('none', 'We do not track this yet', X));
    return { t: 'How do you currently connect your marketing to ' + c.o + '?', multi: true, help: 'Select all that apply.', o: o };
  }

  /* ---------- Previous attempts (Q12 A, B, C) ----------
     Structured so the diagnosis never has to guess from free text. Each attempt code is linked,
     in the rules file, to the explanations it would address. */
  var ATTEMPTS = {
    targeting: 'Changed who our ads or promotions target',
    creative: 'Changed ad creative, content or messaging',
    budget: 'Increased or moved marketing budget',
    new_channel: 'Started using a new marketing channel',
    promo: 'Ran new discounts or promotions',
    pricing: 'Changed prices, packages or plans',
    delivery: 'Changed delivery fees, or showed them earlier',
    checkout: 'Simplified checkout or added payment options',
    pages: 'Improved product pages or listings',
    website: 'Improved the website or landing pages',
    speed: 'Made the website or pages load faster',
    tracking: 'Set up or fixed tracking and reporting',
    response: 'Replied faster or improved follow-up of enquiries',
    reminders: 'Added reminders, confirmations or deposits',
    qualify: 'Added questions or filters before people enquire',
    proof: 'Added reviews, testimonials or case studies',
    proposals: 'Changed proposals, demos or sales conversations',
    onboarding: 'Changed onboarding or the free trial',
    retention: 'Started or changed follow-ups, loyalty or win-back messages',
    capacity: 'Changed staffing, stock, slots or opening hours',
    staff: 'Trained staff or changed the in-store experience',
    local: 'Updated Google Business Profile, maps or local listings',
    stockists: 'Added stockists or made where to buy clearer'
  };
  // Branch-relevant attempt lists (label overrides where the wording should change).
  var ATTEMPT_SETS = {
    A: function (c) { var l = ['targeting', 'creative', 'budget', 'promo'];
      if (c.sub === 'dm') return l.concat(['response', 'delivery', 'proof', 'retention', 'tracking']);
      if (c.sub === 'marketplace' || c.sub === 'tiktok') return l.concat(['pages', 'delivery', 'proof', 'retention', 'tracking']);
      return l.concat(['pages', 'delivery', 'checkout', 'speed', 'retention', 'tracking']); },
    B: function (c) { var l = ['targeting', 'creative', 'budget', 'website', 'pricing'];
      if (c.sub === 'demo') return l.concat(['qualify', 'response', 'proposals', 'retention', 'tracking']);
      return l.concat(['onboarding', 'checkout', 'retention', 'tracking']); },
    C: function (c) { var l = ['targeting', 'creative', 'promo', 'local'];
      if (c.sub === 'catering') return l.concat(['response', 'pricing', 'capacity', 'retention', 'tracking']);
      if (c.sub === 'dinein') return l.concat(['capacity', 'staff', 'reminders', 'retention', 'tracking']);
      return l.concat(['delivery', 'capacity', 'pricing', 'retention', 'tracking']); },
    D: function (c) { var l = ['targeting', 'creative', 'promo', 'local', 'staff', 'capacity'];
      if (c.sub === 'click_collect') l.push('checkout');
      return l.concat(['pricing', 'retention', 'tracking']); },
    E: function () { return ['targeting', 'creative', 'budget', 'pages', 'qualify', 'response', 'reminders', 'proposals', 'tracking']; },
    F: function (c) { var l = ['targeting', 'creative', 'website', 'qualify', 'response', 'reminders', 'proposals', 'proof', 'pricing'];
      if (c.sub === 'retainer') l.push('retention'); return l.concat(['tracking']); },
    G: function () { return ['targeting', 'creative', 'promo', 'local', 'qualify', 'response', 'reminders', 'capacity', 'retention', 'tracking']; },
    H: function (c) { if (c.sub === 'self_paced') return ['targeting', 'creative', 'budget', 'website', 'pricing', 'onboarding', 'proof', 'retention', 'tracking'];
      return ['targeting', 'creative', 'promo', 'qualify', 'response', 'reminders', 'proposals', 'capacity', 'retention', 'tracking']; },
    I: function () { return ['targeting', 'creative', 'budget', 'promo', 'stockists', 'pages', 'retention', 'tracking']; }
  };
  var ATTEMPT_LABELS = {
    E: { pages: 'Improved listings, photos or listing details', reminders: 'Added viewing reminders or confirmations', proposals: 'Changed how offers or negotiations are handled' },
    F: { reminders: 'Added meeting reminders or confirmations', retention: 'Changed how renewals are handled' },
    G: { reminders: 'Added appointment reminders, confirmations or deposits', capacity: 'Changed practitioner hours or appointment slots', qualify: 'Made services and suitability clearer before booking' },
    H: { proposals: 'Changed what happens after a trial or consultation', capacity: 'Changed intake dates, class times or class sizes', reminders: 'Added class or trial reminders' },
    C: { reminders: 'Added booking reminders or deposits', capacity: 'Changed staffing, menu or opening hours' },
    D: { capacity: 'Changed stock levels or product range', checkout: 'Changed how click-and-collect orders are confirmed or prepared' },
    I: { pages: 'Changed packaging or product information' },
    B: { checkout: 'Simplified payment or upgrade steps' }
  };
  function q12(c) {
    var codes = ATTEMPT_SETS[c.b] ? ATTEMPT_SETS[c.b](c) : ['targeting', 'creative', 'budget', 'promo', 'tracking'];
    var lab = ATTEMPT_LABELS[c.b] || {};
    var o = codes.map(function (k) { return O(k, lab[k] || ATTEMPTS[k]); });
    o.push(O('other', 'Something else (tell us)', { txt: true, txtLabel: 'What did you change? (optional)' }));
    o.push(O('nothing', 'Nothing yet', X));
    return { t: 'What have you already tried to improve this?', help: 'Select all that apply.', multi: true, o: o };
  }
  function q12b(n) {
    var many = n > 1;
    return { t: many ? 'What happened after these changes, taken together?' : 'What happened after this change?',
      help: many ? 'Tell us the overall result. We won’t assume it applies to each change separately.' : 'Choose the closest answer.',
      o: [O('improved', 'Results improved'), O('no_change', 'No clear change'), O('worse', 'Results got worse'),
        O('too_early', 'Too early to tell'), O('not_measured', 'We haven’t measured the impact')] };
  }
  var DATA = { INDUSTRIES: INDUSTRIES, R1: R1, BR: BR, GP: GP, GOAL_STAGE: GOAL_STAGE,
    outcomeFor: outcomeFor, q6: q6, q10: q10, q11: q11, q12: q12, q12b: q12b, ATTEMPTS: ATTEMPTS, O: O, NA: NA };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA; else root.TMO_DATA = DATA;
})(this);

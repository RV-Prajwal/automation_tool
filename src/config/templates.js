export const emailTemplates = {
  restaurant: {
    subject: 'Help More Diners Find {businessName} Online',
    body: `Dear {businessName} Team,

I noticed your restaurant while searching for local businesses in {location}, and I see you don't currently have a website.

In today's digital age, 78% of diners search online before visiting a restaurant. Without a website, you might be missing out on potential customers.

I'd like to offer you a complete website solution for just ₹{price}:

✓ Professional, mobile-responsive website
✓ Menu showcase with photos
✓ Contact & location information
✓ Online inquiry form
✓ Domain & hosting setup
✓ 6 months FREE maintenance & support

This is a one-time investment that will help grow your customer base and establish your online presence.

Would you be interested in a quick 10-minute call to discuss how we can help {businessName} reach more customers?

Best regards,
{senderName}
{phone}

P.S. Limited slots available this month. Reply with "INTERESTED" to learn more.

---
If you'd like to unsubscribe, click here: {unsubscribeLink}`
  },

  retail: {
    subject: 'Expand {businessName}\'s Customer Reach with a Professional Website',
    body: `Dear {businessName} Team,

I came across your store in {location} and noticed you don't have a website yet.

Did you know that 82% of shoppers research online before buying locally? A website can significantly increase your store's visibility and customer base.

I specialize in creating affordable websites for local businesses like yours:

📦 What You Get (₹{price} one-time):
✓ Custom-designed professional website
✓ Product/service showcase
✓ Mobile-friendly design
✓ Contact forms & Google Maps integration
✓ Basic SEO setup
✓ 6 months of support included

This investment pays for itself by bringing in just 1-2 additional customers per month.

Can we schedule a brief call to discuss how a website can help {businessName} grow?

Best regards,
{senderName}
{phone}

Reply "YES" to get started or ask any questions.

---
Unsubscribe: {unsubscribeLink}`
  },

  services: {
    subject: 'Build Trust & Credibility for {businessName} with a Professional Website',
    body: `Dear {businessName},

I discovered your business while researching service providers in {location}. I noticed you're not online yet, which could be limiting your growth.

85% of customers check a business's website before contacting them. Without one, potential clients may choose competitors instead.

I offer an affordable website solution designed for service businesses:

🎯 Complete Package (₹{price}):
✓ Professional website with service descriptions
✓ Contact forms & online inquiry system
✓ Testimonials & portfolio section
✓ Mobile-optimized design
✓ SEO basics to appear in local searches
✓ 6 months maintenance included

A website establishes credibility and makes it easier for customers to find and trust you.

Would you be open to a quick 10-minute discussion about taking {businessName} online?

Best regards,
{senderName}
{phone}

Reply "INTERESTED" and I'll send you examples of similar businesses we've helped.

---
To unsubscribe: {unsubscribeLink}`
  },

  default: {
    subject: 'Professional Website for {businessName} - ₹{price} All-Inclusive',
    body: `Dear {businessName} Team,

I noticed your business in {location} and wanted to reach out with an opportunity.

In today's digital world, having a professional website is essential for business growth. I help local businesses like yours establish their online presence affordably.

💼 Complete Website Package (₹{price}):
✓ Custom-designed professional website
✓ Mobile-responsive & fast-loading
✓ Contact forms & business information
✓ Domain setup & deployment
✓ Basic SEO optimization
✓ 6 months of support & maintenance

This is a one-time investment with no recurring fees. You own everything.

Why invest in a website?
• Reach customers 24/7
• Build credibility and trust
• Appear in local search results
• Stay competitive with other businesses

Can we schedule a brief 10-minute call to discuss how a website can benefit {businessName}?

Best regards,
{senderName}
{phone}

Reply "YES" to learn more or ask any questions.

---
Unsubscribe from future emails: {unsubscribeLink}`
  },

  followUp1: {
    subject: 'Following up: Website for {businessName}',
    body: `Hi {businessName} Team,

I sent you an email a few days ago about creating a professional website for your business.

I understand you're busy running your business. That's exactly why having a website helps - it works for you 24/7, bringing in new customers even when you're focused on other things.

Quick recap of what you get for ₹{price}:
✓ Complete website development
✓ Mobile-friendly design
✓ 6 months free support
✓ One-time payment, no hidden fees

Would you have 10 minutes this week for a quick call?

Best regards,
{senderName}
{phone}

---
Unsubscribe: {unsubscribeLink}`
  },

  followUp2: {
    subject: 'Last call: Website opportunity for {businessName}',
    body: `Hi {businessName},

This is my final follow-up regarding a website for your business.

I wanted to give you one last opportunity to take advantage of our ₹{price} all-inclusive website package before we close this month's slots.

If you're not interested, no problem - I won't contact you again.

If you'd like to discuss how a website can help your business grow, simply reply "INTERESTED" and I'll get back to you right away.

Best regards,
{senderName}
{phone}

---
Unsubscribe: {unsubscribeLink}`
  }
};

export const getTemplate = (category) => {
  const normalizedCategory = category?.toLowerCase() || '';
  
  if (normalizedCategory.includes('restaurant') || normalizedCategory.includes('cafe') || normalizedCategory.includes('food')) {
    return emailTemplates.restaurant;
  }
  
  if (normalizedCategory.includes('retail') || normalizedCategory.includes('shop') || normalizedCategory.includes('store')) {
    return emailTemplates.retail;
  }
  
  if (normalizedCategory.includes('service') || normalizedCategory.includes('repair') || normalizedCategory.includes('consulting')) {
    return emailTemplates.services;
  }
  
  return emailTemplates.default;
};

export const getFollowUpTemplate = (followUpNumber) => {
  if (followUpNumber === 1) return emailTemplates.followUp1;
  if (followUpNumber === 2) return emailTemplates.followUp2;
  return null;
};

export default emailTemplates;

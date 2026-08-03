/**
 * GroupGuard Phone Validation API
 *
 * This Apps Script acts as a proxy to the NumVerify / APILayer API
 * and returns risk assessment data for phone numbers.
 *
 * Deploy as: Web App (Execute as: Me, Access: Anyone, allow anyone to invoke)
 *
 * NOTE: The API key below has already been exposed publicly in this
 * repository's history. Use a FREE APILayer NumLookup key of your own and
 * REPLACE it, or your requests will be limited/blocked.
 */

// Get your own free key at https://apilayer.com/marketplace/number_verification-api
// IMPORTANT: paste YOUR key here. The one you already deployed to Apps Script
// continues to power the live lookup URL in script.js — this repo copy is a
// template and must not contain a real key.
const NUMVERIFY_API_KEY = 'YOUR_APILAYER_KEY_HERE';

// APILayer Number Verification endpoint (returns valid, country, carrier, line_type, etc.)
const NUMVERIFY_BASE_URL = 'https://api.apilayer.com/number_verification/validate';

// Optional but recommended: fail fast and gracefully. Apps Script UrlFetchApp
// resolves DNS automatically, so no manual proxy is needed.

function doGet(e) {
  // Enable CORS for GitHub Pages
  const output = ContentService.createTextOutput()
    .setMimeType(ContentService.MimeType.JSON);

  try {
    const action = e.parameter.action;

    if (action === 'phone') {
      const number = e.parameter.number;
      if (!number) {
        return output.setContent(JSON.stringify({ error: 'No phone number provided.' }));
      }
      return output.setContent(JSON.stringify(validatePhoneNumber(number)));
    }

    return output.setContent(JSON.stringify({ error: 'Invalid action.' }));

  } catch (err) {
    return output.setContent(JSON.stringify({ error: err.message }));
  }
}

function validatePhoneNumber(number) {
  // Strip everything except digits for maximum compatibility with the API
  const cleanNumber = number.replace(/[^\d]/g, '');

  if (!cleanNumber) {
    return { error: 'Invalid number format. Please provide digits including the country code.' };
  }

  const url = `${NUMVERIFY_BASE_URL}?number=${encodeURIComponent(cleanNumber)}`;

  const options = {
    method: 'get',
    headers: { 'apikey': NUMVERIFY_API_KEY },
    muteHttpExceptions: true,
    timeout: 15000
  };

  let response;
  let data;
  try {
    response = UrlFetchApp.fetch(url, options);
  } catch (fetchErr) {
    return {
      error: 'Network error reaching the validation service.',
      riskLevel: 'ERROR',
      validation: 'Service unreachable.',
      indicators: 'API call failed.',
      recommendation: 'MANUAL CHECK',
      notes: `The validation service could not be reached (${fetchErr.message}).`
    };
  }

  const httpCode = response.getResponseCode();
  try {
    data = JSON.parse(response.getContentText());
  } catch (parseErr) {
    return {
      error: `Validation service returned a non-JSON response (HTTP ${httpCode}).`,
      riskLevel: 'ERROR',
      validation: 'Service error.',
      indicators: 'Unreadable response.',
      recommendation: 'MANUAL CHECK',
      notes: 'The validation service returned an unexpected response.'
    };
  }

  // Check for API errors (missing key, quota, failed validation)
  if (data.error) {
    const msg = (data.error.info || data.error.message) || 'Validation failed.';
    return {
      error: msg,
      riskLevel: 'ERROR',
      validation: 'Service error.',
      indicators: 'API check failed.',
      recommendation: 'MANUAL CHECK',
      notes: `The validation service returned an error: ${msg}`
    };
  }

  if (httpCode !== 200 && !data.valid) {
    return {
      error: `Service returned HTTP ${httpCode}.`,
      riskLevel: 'ERROR',
      validation: 'Service error.',
      indicators: 'Request rejected.',
      recommendation: 'MANUAL CHECK',
      notes: 'The request was not fulfilled by the validation service.'
    };
  }

  return buildRiskAssessment(data);
}

function buildRiskAssessment(apiData) {
  let riskLevel = 'LOW';
  let recommendation = 'ALLOW';
  const notes = [];

  // 1. Validity check
  if (apiData.valid === false) {
    return {
      riskLevel: 'HIGH',
      recommendation: 'BLOCK',
      report: 'Risk level: HIGH\nAdmin recommendation: BLOCK\n' +
        'Notes on uncertainty: Number failed global validation checks. Verify the format manually.'
    };
  }

  // 2. Identify carrier & type
  const lineType = (apiData.line_type || apiData.lineType || 'unknown').toLowerCase();
  const carrier = apiData.carrier || 'Unknown Carrier';
  const country = apiData.country_name || apiData.countryCode || '';

  // 3. Heuristic analysis
  if (lineType === 'voip') {
    riskLevel = 'MEDIUM';
    recommendation = 'MONITOR';
    notes.push('Identified as a VoIP or virtual number, which carries a higher risk of anonymity.');
  } else if (lineType === 'landline' || lineType === 'fixed_line' || lineType === 'fixed') {
    riskLevel = 'MEDIUM';
    recommendation = 'MONITOR';
    notes.push('Registry indicates a landline connection, which is atypical for personal WhatsApp accounts.');
  } else {
    notes.push(`Standard mobile connection detected${carrier !== 'Unknown Carrier' ? ` via ${carrier}.` : '.'}`);
  }

  if (apiData.portable === false) {
    notes.push('Number is not portable.');
  }

  if (notes.length === 0) notes.push('No obvious risk signatures detected.');

  // Richer report than the original, still compact.
  const reportLines = [
    `Risk level: ${riskLevel}`,
    `Admin recommendation: ${recommendation}`,
    `Carrier: ${carrier}`,
    `${country ? `Country: ${country}` : ''}`.replace(/\s+$/, ''),
    `Line type: ${lineType || 'unknown'}`,
    `Number: ${apiData.number || 'n/a'}`,
    `Notes on uncertainty: ${notes.join(' ')}`
  ].filter(l => l.length > 0);

  return {
    riskLevel,
    recommendation,
    report: report.join('\n')
  };
}

// Test function for debugging in Apps Script editor
function testValidation() {
  const result = validatePhoneNumber('+14155552671');
  Logger.log(result);
}
# Cloudflare DNS zone for startlineau.com.
#
# This file mirrors the Route 53 records in dns.tf. After the Cloudflare
# nameservers are configured at GoDaddy, the Route 53 zone can be removed.

resource "cloudflare_zone" "primary" {
  account_id = var.cloudflare_account_id
  zone       = "startlineau.com"
}

# ===== Microsoft 365 / Outlook =====

resource "cloudflare_record" "mx" {
  zone_id  = cloudflare_zone.primary.id
  name     = "startlineau.com"
  type     = "MX"
  ttl      = 3600
  content  = "startlineau-com.mail.protection.outlook.com"
  priority = 0
}

resource "cloudflare_record" "autodiscover" {
  zone_id = cloudflare_zone.primary.id
  name    = "autodiscover"
  type    = "CNAME"
  ttl     = 3600
  content = "autodiscover.outlook.com"
}

resource "cloudflare_record" "email_cname" {
  zone_id = cloudflare_zone.primary.id
  name    = "email"
  type    = "CNAME"
  ttl     = 3600
  content = "email.secureserver.net"
}

resource "cloudflare_record" "lyncdiscover" {
  zone_id = cloudflare_zone.primary.id
  name    = "lyncdiscover"
  type    = "CNAME"
  ttl     = 3600
  content = "webdir.online.lync.com"
}

resource "cloudflare_record" "msoid" {
  zone_id = cloudflare_zone.primary.id
  name    = "msoid"
  type    = "CNAME"
  ttl     = 3600
  content = "clientconfig.microsoftonline-p.net"
}

resource "cloudflare_record" "sip_cname" {
  zone_id = cloudflare_zone.primary.id
  name    = "sip"
  type    = "CNAME"
  ttl     = 3600
  content = "sipdir.online.lync.com"
}

resource "cloudflare_record" "sip_srv" {
  zone_id = cloudflare_zone.primary.id
  name    = "_sip._tls.startlineau.com"
  type    = "SRV"
  data {
    service  = "_sip"
    proto    = "_tls"
    name     = "startlineau.com"
    priority = 100
    weight   = 1
    port     = 443
    target   = "sipdir.online.lync.com"
  }
}

resource "cloudflare_record" "sipfederation_srv" {
  zone_id = cloudflare_zone.primary.id
  name    = "_sipfederationtls._tcp.startlineau.com"
  type    = "SRV"
  data {
    service  = "_sipfederationtls"
    proto    = "_tcp"
    name     = "startlineau.com"
    priority = 100
    weight   = 1
    port     = 5061
    target   = "sipfed.online.lync.com"
  }
}

# ===== Resend (transactional sender on send.startlineau.com) =====

resource "cloudflare_record" "send_mx" {
  zone_id  = cloudflare_zone.primary.id
  name     = "send"
  type     = "MX"
  ttl      = 3600
  content  = "feedback-smtp.ap-northeast-1.amazonses.com"
  priority = 10
}

resource "cloudflare_record" "send_spf" {
  zone_id = cloudflare_zone.primary.id
  name    = "send"
  type    = "TXT"
  ttl     = 3600
  content = "v=spf1 include:secureserver.net include:amazonses.com ~all"
}

resource "cloudflare_record" "send_spfm" {
  zone_id = cloudflare_zone.primary.id
  name    = "dc-fd741b8612._spfm.send"
  type    = "TXT"
  ttl     = 3600
  content = "v=spf1 include:amazonses.com ~all"
}

resource "cloudflare_record" "resend_dkim" {
  zone_id = cloudflare_zone.primary.id
  name    = "resend._domainkey"
  type    = "TXT"
  ttl     = 3600
  content = "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDCxZV6xZfEAVwIGGNjvbOZlYPABNnYesQswgsrcrHBZNXAzfaGSSSkIp8N5UGpEcPIwofFHj2I8BD9TuKlZk9P0CSOsSar8Ao85og76GI/ZjWTe9e9uWUjdqIuFr/dwS58H9JGpl/qQreeVMPCOyuWpYMsQKNFM8kLPz9VooufRQIDAQAB"
}

# ===== Apex TXT (verifications + SPF) =====

resource "cloudflare_record" "apex_txt" {
  zone_id = cloudflare_zone.primary.id
  name    = "startlineau.com"
  type    = "TXT"
  ttl     = 3600
  content = "google-site-verification=jIvCl0g9VHCo7zeWBKui3Vzxj9F5qXz51Goh8-OGO6U"
}

resource "cloudflare_record" "apex_txt_microsoft" {
  zone_id = cloudflare_zone.primary.id
  name    = "startlineau.com"
  type    = "TXT"
  ttl     = 3600
  content = "NETORGFT20392808.onmicrosoft.com"
}

resource "cloudflare_record" "apex_txt_spf" {
  zone_id = cloudflare_zone.primary.id
  name    = "startlineau.com"
  type    = "TXT"
  ttl     = 3600
  content = "v=spf1 include:secureserver.net -all"
}

resource "cloudflare_record" "dmarc" {
  zone_id = cloudflare_zone.primary.id
  name    = "_dmarc"
  type    = "TXT"
  ttl     = 3600
  content = "v=DMARC1; p=none;"
}

# ===== Amplify hosting =====
# Targets are resolved from the Amplify domain association in dns.tf locals.
# Cloudflare supports CNAME flattening at the apex — no ALIAS record needed.

resource "cloudflare_record" "apex" {
  zone_id = cloudflare_zone.primary.id
  name    = "startlineau.com"
  type    = "CNAME"
  ttl     = 1
  content = local.amplify_apex_target
  proxied = true
}

resource "cloudflare_record" "www" {
  zone_id = cloudflare_zone.primary.id
  name    = "www"
  type    = "CNAME"
  ttl     = 1
  content = local.amplify_www_target
  proxied = true
}

resource "cloudflare_record" "organiser" {
  zone_id = cloudflare_zone.primary.id
  name    = "organiser"
  type    = "CNAME"
  ttl     = 1
  content = local.amplify_organiser_target
  proxied = true
}

# Amplify ACM certificate validation — must be DNS-only (unproxied)
resource "cloudflare_record" "amplify_cert_validation" {
  zone_id = cloudflare_zone.primary.id
  name    = trimsuffix(local.amplify_cert_record[0], ".")
  type    = "CNAME"
  ttl     = 300
  content = trimsuffix(local.amplify_cert_record[1], ".")
}

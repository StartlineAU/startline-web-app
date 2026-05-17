resource "aws_route53_zone" "primary" {
  name    = "startlineau.com"
  comment = "Primary DNS for startlineau.com (registration stays at GoDaddy)"
}

# === Microsoft 365 / Outlook ===

resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "startlineau.com"
  type    = "MX"
  ttl     = 3600
  records = ["0 startlineau-com.mail.protection.outlook.com"]
}

resource "aws_route53_record" "autodiscover" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "autodiscover.startlineau.com"
  type    = "CNAME"
  ttl     = 3600
  records = ["autodiscover.outlook.com"]
}

resource "aws_route53_record" "email_cname" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "email.startlineau.com"
  type    = "CNAME"
  ttl     = 3600
  records = ["email.secureserver.net"]
}

resource "aws_route53_record" "lyncdiscover" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "lyncdiscover.startlineau.com"
  type    = "CNAME"
  ttl     = 3600
  records = ["webdir.online.lync.com"]
}

resource "aws_route53_record" "msoid" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "msoid.startlineau.com"
  type    = "CNAME"
  ttl     = 3600
  records = ["clientconfig.microsoftonline-p.net"]
}

resource "aws_route53_record" "sip_cname" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "sip.startlineau.com"
  type    = "CNAME"
  ttl     = 3600
  records = ["sipdir.online.lync.com"]
}

resource "aws_route53_record" "sip_srv" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "_sip._tls.startlineau.com"
  type    = "SRV"
  ttl     = 3600
  records = ["100 1 443 sipdir.online.lync.com"]
}

resource "aws_route53_record" "sipfederation_srv" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "_sipfederationtls._tcp.startlineau.com"
  type    = "SRV"
  ttl     = 3600
  records = ["100 1 5061 sipfed.online.lync.com"]
}

# === Resend (transactional sender on send.startlineau.com) ===

resource "aws_route53_record" "send_mx" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "send.startlineau.com"
  type    = "MX"
  ttl     = 3600
  records = ["10 feedback-smtp.ap-northeast-1.amazonses.com"]
}

resource "aws_route53_record" "send_spf" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "send.startlineau.com"
  type    = "TXT"
  ttl     = 3600
  records = ["v=spf1 include:secureserver.net include:amazonses.com ~all"]
}

resource "aws_route53_record" "send_spfm" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "dc-fd741b8612._spfm.send.startlineau.com"
  type    = "TXT"
  ttl     = 3600
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "resend_dkim" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "resend._domainkey.startlineau.com"
  type    = "TXT"
  ttl     = 3600
  records = ["p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDCxZV6xZfEAVwIGGNjvbOZlYPABNnYesQswgsrcrHBZNXAzfaGSSSkIp8N5UGpEcPIwofFHj2I8BD9TuKlZk9P0CSOsSar8Ao85og76GI/ZjWTe9e9uWUjdqIuFr/dwS58H9JGpl/qQreeVMPCOyuWpYMsQKNFM8kLPz9VooufRQIDAQAB"]
}

# === Apex TXT (verifications + SPF) ===

resource "aws_route53_record" "apex_txt" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "startlineau.com"
  type    = "TXT"
  ttl     = 3600
  records = [
    "google-site-verification=jIvCl0g9VHCo7zeWBKui3Vzxj9F5qXz51Goh8-OGO6U",
    "NETORGFT20392808.onmicrosoft.com",
    "v=spf1 include:secureserver.net -all",
  ]
}

resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "_dmarc.startlineau.com"
  type    = "TXT"
  ttl     = 3600
  records = ["v=DMARC1; p=none;"]
}

# === Amplify hosting ===
# CloudFront's global hosted zone ID for ALIAS records.
locals {
  cloudfront_hosted_zone_id = "Z2FDTNDATAQYW2"

  # Each sub_domain.dns_record looks like " CNAME d4wzmtvlx0pe1.cloudfront.net";
  # extract just the hostname for ALIAS / CNAME targets.
  amplify_sub_domains_by_prefix = {
    for s in aws_amplify_domain_association.this[0].sub_domain :
    s.prefix => regex("([a-z0-9-]+\\.cloudfront\\.net)", s.dns_record)[0]
  }

  amplify_apex_target = local.amplify_sub_domains_by_prefix[""]
  amplify_www_target  = local.amplify_sub_domains_by_prefix["www"]

  # certificate_verification_dns_record looks like
  # "_xxx.startlineau.com. CNAME _yyy.acm-validations.aws."
  amplify_cert_record = split(" CNAME ", aws_amplify_domain_association.this[0].certificate_verification_dns_record)
}

resource "aws_route53_record" "amplify_cert_validation" {
  zone_id         = aws_route53_zone.primary.zone_id
  name            = trimsuffix(local.amplify_cert_record[0], ".")
  type            = "CNAME"
  ttl             = 300
  records         = [trimsuffix(local.amplify_cert_record[1], ".")]
  allow_overwrite = true
}

resource "aws_route53_record" "apex_alias" {
  zone_id         = aws_route53_zone.primary.zone_id
  name            = "startlineau.com"
  type            = "A"
  allow_overwrite = true

  alias {
    name                   = local.amplify_apex_target
    zone_id                = local.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_cname" {
  zone_id         = aws_route53_zone.primary.zone_id
  name            = "www.startlineau.com"
  type            = "CNAME"
  ttl             = 300
  records         = [local.amplify_www_target]
  allow_overwrite = true
}

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Environment = "Production"
      Project     = "Nexus Apollo"
      ManagedBy   = "Terraform"
      Governance  = "Cloud Nexus"
    }
  }
}

# 1. Bucket S3 Principal
resource "aws_s3_bucket" "nexus_apollo_data" {
  bucket = "nexus-apollo-data"

  lifecycle {
    prevent_destroy = true
  }
}

# 2. Bloqueio Integral de Acesso Público (Block Public Access)
resource "aws_s3_bucket_public_access_block" "nexus_apollo_data" {
  bucket = aws_s3_bucket.nexus_apollo_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 3. Controle de Propriedade dos Objetos (Bucket Owner Enforced - Desativa ACLs)
resource "aws_s3_bucket_ownership_controls" "nexus_apollo_data" {
  bucket = aws_s3_bucket.nexus_apollo_data.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# 4. Habilitação de Versionamento
resource "aws_s3_bucket_versioning" "nexus_apollo_data" {
  bucket = aws_s3_bucket.nexus_apollo_data.id

  versioning_configuration {
    status = "Enabled"
  }
}

# 5. Criptografia em Repouso (Server-Side Encryption SSE-S3 / AES256)
resource "aws_s3_bucket_server_side_encryption_configuration" "nexus_apollo_data" {
  bucket = aws_s3_bucket.nexus_apollo_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# 6. Política de Bucket: Imposição de Tráfego Seguro via HTTPS (TLS 1.2+)
resource "aws_s3_bucket_policy" "enforce_tls" {
  bucket = aws_s3_bucket.nexus_apollo_data.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceTLSRequestsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.nexus_apollo_data.arn,
          "${aws_s3_bucket.nexus_apollo_data.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}
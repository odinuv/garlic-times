variable "subscription_id" {
  type        = string
  description = "Azure subscription id. If null, the ARM_SUBSCRIPTION_ID env var (or `az account set`) is used."
  default     = null
}

variable "resource_group_name" {
  type        = string
  description = "Name of the resource group to create for the state storage."
  default     = "the-garlic-times-rg"
}

variable "location" {
  type        = string
  description = "Azure region for the resource group and storage account."
  default     = "westeurope"
}

variable "storage_account_name" {
  type        = string
  description = "Globally-unique storage account name (3-24 chars, lowercase letters and digits only)."

  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.storage_account_name))
    error_message = "storage_account_name must be 3-24 characters, lowercase letters and digits only (no hyphens)."
  }
}

variable "container_name" {
  type        = string
  description = "Blob container that holds the pipeline state tarball. Wire this into the AZURE_STORAGE_CONTAINER secret."
  default     = "garlic-times-state"

  # Terraform uses RE2 (no lookahead), so "no consecutive hyphens" is a separate
  # negative check rather than an inline lookahead.
  validation {
    condition = (
      can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.container_name))
      && !can(regex("--", var.container_name))
    )
    error_message = "container_name must be 3-63 chars, lowercase letters/digits/hyphens, no leading/trailing or consecutive hyphens."
  }
}

variable "analytics_container_name" {
  type        = string
  description = "Blob container that holds the weekly traffic analytics (raw JSON + rendered markdown reports + rolling traffic-log.md). Wire this into the ANALYTICS_BLOB_CONTAINER GitHub variable."
  default     = "garlic-times-analytics"

  # Same rules as container_name: RE2 (no lookahead), so "no consecutive
  # hyphens" is a separate negative check.
  validation {
    condition = (
      can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.analytics_container_name))
      && !can(regex("--", var.analytics_container_name))
    )
    error_message = "analytics_container_name must be 3-63 chars, lowercase letters/digits/hyphens, no leading/trailing or consecutive hyphens."
  }
}

variable "enable_versioning" {
  type        = bool
  description = "Enable blob versioning for durability (rollback of a corrupt state upload). Adds storage cost for retained versions; paired with a lifecycle rule that expires old versions."
  default     = false
}

variable "noncurrent_version_expiration_days" {
  type        = number
  description = "When versioning is enabled, delete noncurrent blob versions older than this many days so old state copies don't accumulate cost."
  default     = 30

  validation {
    condition     = var.noncurrent_version_expiration_days >= 1
    error_message = "noncurrent_version_expiration_days must be at least 1."
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to all created resources."
  default = {
    project    = "the-garlic-times"
    managed_by = "terraform"
  }
}

# Low-cost Azure Blob Storage for The Garlic Times' daily pipeline state
# (the cumulative `state-latest.tar.gz` archive). Cheapest sensible posture:
# Standard tier, locally-redundant (LRS), general-purpose v2, Hot access tier
# (the single small blob is read + written every run, so Hot beats Cool once
# transaction/early-deletion costs are counted).

resource "azurerm_resource_group" "this" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

resource "azurerm_storage_account" "this" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.this.name
  location                 = azurerm_resource_group.this.location
  account_tier             = "Standard"
  account_replication_type = "LRS"       # cheapest redundancy
  account_kind             = "StorageV2" # required for the blob lifecycle policy below
  access_tier              = "Hot"

  # Security hardening — none of these change cost.
  https_traffic_only_enabled      = true
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false

  # GitHub-hosted runners reach the account over the public internet using the
  # account key (connection string), so public access + shared key stay on.
  public_network_access_enabled = true
  shared_access_key_enabled     = true

  blob_properties {
    versioning_enabled = var.enable_versioning
  }

  tags = var.tags
}

resource "azurerm_storage_container" "state" {
  name                  = var.container_name
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "private"
}

# Only meaningful when versioning is on: expire noncurrent versions so old
# copies of the growing state tarball don't pile up storage cost.
resource "azurerm_storage_management_policy" "this" {
  count              = var.enable_versioning ? 1 : 0
  storage_account_id = azurerm_storage_account.this.id

  rule {
    name    = "expire-old-state-versions"
    enabled = true

    filters {
      blob_types = ["blockBlob"]
    }

    actions {
      version {
        delete_after_days_since_creation = var.noncurrent_version_expiration_days
      }
    }
  }
}

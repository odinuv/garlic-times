provider "azurerm" {
  features {}

  # azurerm v4 requires a subscription id. Leave var unset to fall back to the
  # ARM_SUBSCRIPTION_ID environment variable / `az account set`.
  subscription_id = var.subscription_id
}

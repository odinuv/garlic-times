output "primary_connection_string" {
  description = "Storage account connection string. Wire into the AZURE_STORAGE_CONNECTION_STRING GitHub secret (consumed by BlobServiceClient.fromConnectionString)."
  value       = azurerm_storage_account.this.primary_connection_string
  sensitive   = true
}

output "container_name" {
  description = "Blob container name. Wire into the AZURE_STORAGE_CONTAINER GitHub secret."
  value       = azurerm_storage_container.state.name
}

output "analytics_container_name" {
  description = "Analytics blob container name. Wire into the ANALYTICS_BLOB_CONTAINER GitHub variable (consumed by scripts/analytics-report.ts)."
  value       = azurerm_storage_container.analytics.name
}

output "storage_account_name" {
  description = "Created storage account name."
  value       = azurerm_storage_account.this.name
}

output "resource_group_name" {
  description = "Created resource group name."
  value       = azurerm_resource_group.this.name
}

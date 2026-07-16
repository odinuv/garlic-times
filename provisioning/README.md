# provisioning — Azure Blob Storage for pipeline state

Terraform root config that creates the low-cost Azure Blob Storage backing the
daily GitHub Actions pipeline (`.github/workflows/daily.yml`). It provisions a
resource group, a storage account, and two private containers — one for the
cumulative `state-latest.tar.gz` archive, one for the weekly traffic analytics —
then outputs the credentials to wire into the workflow's GitHub secrets/vars.

## What it creates

| Resource | Setting | Why |
| --- | --- | --- |
| `azurerm_resource_group` | region `westeurope` (var) | container for the account |
| `azurerm_storage_account` | Standard · **LRS** · StorageV2 · **Hot** | cheapest redundancy; Hot suits one small blob read+written daily |
| `azurerm_storage_container.state` | `private` access | holds `state-latest.tar.gz` |
| `azurerm_storage_container.analytics` | `private` access | holds the weekly traffic report: `raw/<date>.json`, `reports/<date>.md`, and the rolling `traffic-log.md` (written by `scripts/analytics-report.ts`) |
| `azurerm_storage_management_policy` | only if `enable_versioning` | expires old blob versions so durability doesn't grow cost |

Analytics blobs are **kept indefinitely** — they're small and the point is a
durable historical baseline, so no lifecycle rule expires them.

Security posture (no cost impact): TLS 1.2 minimum, HTTPS-only, no public blob
access. Public network access + shared-key auth stay **on** because
GitHub-hosted runners reach the account over the public internet with the
connection string.

## Cost

A single ~tens-of-MB blob written and read once per day on Standard/LRS/Hot
costs on the order of a few cents/month (storage + a handful of transactions).
`enable_versioning = true` adds the storage of retained versions; the bundled
lifecycle rule deletes noncurrent versions after
`noncurrent_version_expiration_days` (default 30) to cap that.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- Azure CLI, logged in: `az login`
- A target subscription: `az account set --subscription <id>` (or set
  `ARM_SUBSCRIPTION_ID`, or the `subscription_id` variable)

## Usage

```bash
cd provisioning
cp terraform.tfvars.example terraform.tfvars   # then edit — storage_account_name must be globally unique
terraform init
terraform plan
terraform apply
```

## Wire the outputs into GitHub

The daily pipeline reads `AZURE_STORAGE_CONNECTION_STRING` and
`AZURE_STORAGE_CONTAINER` as repo secrets; the weekly traffic report additionally
reads the analytics container name from the `ANALYTICS_BLOB_CONTAINER` repo
**variable** (same connection string). After `apply` (run from `provisioning/`,
with the [`gh`](https://cli.github.com/) CLI authenticated):

```bash
gh secret   set AZURE_STORAGE_CONNECTION_STRING --body "$(terraform output -raw primary_connection_string)"
gh secret   set AZURE_STORAGE_CONTAINER         --body "$(terraform output -raw container_name)"
gh variable set ANALYTICS_BLOB_CONTAINER        --body "$(terraform output -raw analytics_container_name)"
```

(`primary_connection_string` is a sensitive output, so print it only when
piping it straight into `gh secret set`.)

## Notes

- **State**: this config keeps Terraform state **local** (gitignored). For
  shared/CI use, add a remote backend (e.g. an `azurerm` backend in its own
  bootstrap storage) — out of scope here.
- `terraform.tfvars` and all state files are gitignored (see `.gitignore`).
- To tear everything down: `terraform destroy` (this deletes the container and
  its archived state — the pipeline would bootstrap fresh on its next run).

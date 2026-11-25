module github.com/peal-social/peal/packages/peal-sdk/go

go 1.21

require github.com/google/uuid v1.6.0

require github.com/stretchr/testify v1.8.4

require gopkg.in/yaml.v3 v3.0.1 // indirect

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
)

retract (
	[v0.1.0, v0.3.0] // Calls the API as it was before /api/v1: use v0.4.0-beta.1 or later.
	v0.3.1 // Contains retractions only.
)

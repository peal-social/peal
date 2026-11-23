pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct EditRenderRequest {
    #[serde(default)]
    pub edit: HashMap<String, serde_json::Value>,
}

impl EditRenderRequest {
    pub fn builder() -> EditRenderRequestBuilder {
        <EditRenderRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct EditRenderRequestBuilder {
    edit: Option<HashMap<String, serde_json::Value>>,
}

impl EditRenderRequestBuilder {
    pub fn edit(mut self, value: HashMap<String, serde_json::Value>) -> Self {
        self.edit = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`EditRenderRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`edit`](EditRenderRequestBuilder::edit)
    pub fn build(self) -> Result<EditRenderRequest, BuildError> {
        Ok(EditRenderRequest {
            edit: self.edit.ok_or_else(|| BuildError::missing_field("edit"))?,
        })
    }
}

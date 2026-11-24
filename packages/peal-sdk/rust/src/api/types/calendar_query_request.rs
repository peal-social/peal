pub use crate::prelude::*;

/// Query parameters for calendar
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct CalendarQueryRequest {
    #[serde(default)]
    pub from: String,
    #[serde(default)]
    pub to: String,
}

impl CalendarQueryRequest {
    pub fn builder() -> CalendarQueryRequestBuilder {
        <CalendarQueryRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct CalendarQueryRequestBuilder {
    from: Option<String>,
    to: Option<String>,
}

impl CalendarQueryRequestBuilder {
    pub fn from(mut self, value: impl Into<String>) -> Self {
        self.from = Some(value.into());
        self
    }

    pub fn to(mut self, value: impl Into<String>) -> Self {
        self.to = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`CalendarQueryRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`from`](CalendarQueryRequestBuilder::from)
    /// - [`to`](CalendarQueryRequestBuilder::to)
    pub fn build(self) -> Result<CalendarQueryRequest, BuildError> {
        Ok(CalendarQueryRequest {
            from: self.from.ok_or_else(|| BuildError::missing_field("from"))?,
            to: self.to.ok_or_else(|| BuildError::missing_field("to"))?,
        })
    }
}

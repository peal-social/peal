pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct InboxReplyWindow {
    #[serde(rename = "closesAt")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub closes_at: Option<String>,
    #[serde(default)]
    pub open: bool,
    #[serde(rename = "personClosesAt")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub person_closes_at: Option<String>,
}

impl InboxReplyWindow {
    pub fn builder() -> InboxReplyWindowBuilder {
        <InboxReplyWindowBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct InboxReplyWindowBuilder {
    closes_at: Option<String>,
    open: Option<bool>,
    person_closes_at: Option<String>,
}

impl InboxReplyWindowBuilder {
    pub fn closes_at(mut self, value: impl Into<String>) -> Self {
        self.closes_at = Some(value.into());
        self
    }

    pub fn open(mut self, value: bool) -> Self {
        self.open = Some(value);
        self
    }

    pub fn person_closes_at(mut self, value: impl Into<String>) -> Self {
        self.person_closes_at = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`InboxReplyWindow`].
    /// This method will fail if any of the following fields are not set:
    /// - [`open`](InboxReplyWindowBuilder::open)
    pub fn build(self) -> Result<InboxReplyWindow, BuildError> {
        Ok(InboxReplyWindow {
            closes_at: self.closes_at,
            open: self.open.ok_or_else(|| BuildError::missing_field("open"))?,
            person_closes_at: self.person_closes_at,
        })
    }
}

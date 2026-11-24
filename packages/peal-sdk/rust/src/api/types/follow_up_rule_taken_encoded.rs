pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct FollowUpRuleTakenEncoded {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(rename = "requestId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(rename = "ruleId")]
    #[serde(default)]
    pub rule_id: String,
}

impl FollowUpRuleTakenEncoded {
    pub fn builder() -> FollowUpRuleTakenEncodedBuilder {
        <FollowUpRuleTakenEncodedBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct FollowUpRuleTakenEncodedBuilder {
    code: Option<String>,
    message: Option<String>,
    request_id: Option<String>,
    rule_id: Option<String>,
}

impl FollowUpRuleTakenEncodedBuilder {
    pub fn code(mut self, value: impl Into<String>) -> Self {
        self.code = Some(value.into());
        self
    }

    pub fn message(mut self, value: impl Into<String>) -> Self {
        self.message = Some(value.into());
        self
    }

    pub fn request_id(mut self, value: impl Into<String>) -> Self {
        self.request_id = Some(value.into());
        self
    }

    pub fn rule_id(mut self, value: impl Into<String>) -> Self {
        self.rule_id = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`FollowUpRuleTakenEncoded`].
    /// This method will fail if any of the following fields are not set:
    /// - [`rule_id`](FollowUpRuleTakenEncodedBuilder::rule_id)
    pub fn build(self) -> Result<FollowUpRuleTakenEncoded, BuildError> {
        Ok(FollowUpRuleTakenEncoded {
            code: self.code,
            message: self.message,
            request_id: self.request_id,
            rule_id: self
                .rule_id
                .ok_or_else(|| BuildError::missing_field("rule_id"))?,
        })
    }
}

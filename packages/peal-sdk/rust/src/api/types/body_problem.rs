pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct BodyProblem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<i64>,
    pub problem: BodyProblemKind,
}

impl BodyProblem {
    pub fn builder() -> BodyProblemBuilder {
        <BodyProblemBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct BodyProblemBuilder {
    column: Option<i64>,
    line: Option<i64>,
    problem: Option<BodyProblemKind>,
}

impl BodyProblemBuilder {
    pub fn column(mut self, value: i64) -> Self {
        self.column = Some(value);
        self
    }

    pub fn line(mut self, value: i64) -> Self {
        self.line = Some(value);
        self
    }

    pub fn problem(mut self, value: BodyProblemKind) -> Self {
        self.problem = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`BodyProblem`].
    /// This method will fail if any of the following fields are not set:
    /// - [`problem`](BodyProblemBuilder::problem)
    pub fn build(self) -> Result<BodyProblem, BuildError> {
        Ok(BodyProblem {
            column: self.column,
            line: self.line,
            problem: self
                .problem
                .ok_or_else(|| BuildError::missing_field("problem"))?,
        })
    }
}

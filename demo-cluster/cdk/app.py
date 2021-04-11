from aws_cdk import (
    aws_events as events,
    aws_lambda as lambda_,
    aws_iam as iam,
    aws_events_targets as targets,
    core,
)


class LambdaCronStack(core.Stack):
    def __init__(self, app: core.App, id: str) -> None:
        super().__init__(app, id)

        lambdaFn = lambda_.Function(
            self, "Singleton",
            code=lambda_.Code.asset("./lambda"),
            handler="index.main",
            timeout=core.Duration.seconds(900),
            runtime=lambda_.Runtime.PYTHON_3_8,
        )

        lambdaFn.add_to_role_policy(iam.PolicyStatement(actions=["ec2:RunInstances", "iam:PassRole", "logs:CreateLogStream", "logs:PutLogEvents", "logs:CreateLogGroup" ],resources=['*']))

        # Run every day at 6PM UTC
        # See https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html
        rule = events.Rule(
            self, "Rule",
            schedule=events.Schedule.cron(
                minute='0',
                hour='5',
                month='*',
                week_day='SUN-FRI',
                year='*'),
        )
        rule.add_target(targets.LambdaFunction(lambdaFn))


app = core.App()
LambdaCronStack(app, "DemoRefresher")
app.synth()

const { baseTemplate } = require("../../messages");

function buildSavingsCreatedEmail({ user, account }) {
  const content = `
          <h2 style="
            margin-top: 0;
            color: ${BRAND_COLOR};
          ">
            Your ${account?.name} Account Has Been Successfully Created
          </h2>
      
          <p>Hello, ${user?.personalInfo?.firstName}</p>
          <p>
            We are excited to inform you that your <b>${account?.name} Account</b> has been successfully created with  <b>Itrust Investment</b>.
          </p>
          <p>You can now begin contributing towards your retirement with a tax-deferred growth. Manage your account, view performance, make contributions anytime through your trust dashboard.</p>
          
          <p>
           If you have any questions or need help setting up your contribution plan, our support team is here to assist.
          </p>
          <p>
           Welcome to smarter retirement planning.
            </p>
        `;

  return baseTemplate({
    title: "Savings Account Created",
    content,
  });
}

function buildContributionEmail({ user, transaction }) {
  const content = `
            <h2 style="
              margin-top: 0;
              color: ${BRAND_COLOR};
            ">
              Contribution Added
            </h2>
        
            <p>Hello, ${user?.personalInfo?.firstName}</p>
            <p>
              We've succesfully received your contribution of <b>${transaction?.amount}</b> to your <b>${transaction?.account}</b>.
            </p>
            <p>Your fund has been added to your retirement savings and will begin accruing according to your selected investment strategy. You can view your updated balance in your dashboard</p>
            
            <p>
             If you have any questions or need help setting up your contribution plan, our support team is here to assist.
            </p>
            <p>
             Thank you for taking a step toward your financial future
              </p>
          `;

  return baseTemplate({
    title: "Contribution Added",
    content,
  });
}

function buildCashoutReqEmail({ user, transaction }) {
  const content = `
              <h2 style="
                margin-top: 0;
                color: ${BRAND_COLOR};
              ">
                Cashout Request
          
              <p>Hello, ${user?.personalInfo?.firstName}</p>
              <p>
                Your cashout request of <b>${transaction?.amount}</b> from your <b>${transaction?.account}</b> is currently processing.
              </p>
              <p>Please allow some time (typically few hours - 2 business days) for the funds to reflect inm your cash account. If this withdrawal affects your tax status or you have questions, we recommend consulting with your financial advisor</p>
              
              <p>
               If you didn't authorize this transaction, contact us at <a href="mailto:support@itrustinvestment.com">
               support@itrustinvestment.com</a>
              </p>
              <p>
               Thank you for taking a step toward your financial future
                </p>
            `;

  return baseTemplate({
    title: "Cashout Requested",
    content,
  });
}

module.exports = {
  buildSavingsCreatedEmail,
  buildContributionEmail,
  buildCashoutReqEmail,
};
